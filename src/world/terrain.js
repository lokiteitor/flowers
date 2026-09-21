import * as THREE from 'three';
import { mulberry32, valueNoise } from '../util/random.js';
import { getTextures } from './textures.js';
import { footprint } from './blocks.js';
import { WORLD_HALF, HILLS_HALF, PATH } from './layout.js';
import { RIVER_HALF, RIVER_BED, riverDistance, isRiverCell } from './river.js';

function hillHeight(ix, iz) {
  const d = Math.max(Math.abs(ix + 0.5), Math.abs(iz + 0.5)) - WORLD_HALF;
  if (d < 0) return 0;
  // El río abre un valle entre las colinas: llano junto al agua y subiendo poco a poco.
  const bank = riverDistance(ix + 0.5, iz + 0.5) - RIVER_HALF - 1.5;
  if (bank < 0) return 0;
  const rough = valueNoise(ix * 0.13, iz * 0.13, 7) * 5 * Math.min(1, d / 5);
  const height = Math.max(1, Math.floor(1 + d * 0.45 + rough));
  return Math.min(height, 1 + Math.floor(bank * 0.8));
}

// Acumula cuadrados sueltos (uno por cara de bloque) en una sola geometría.
class QuadBatch {
  positions = [];
  normals = [];
  uvs = [];
  indices = [];

  // Esquinas en sentido antihorario vistas desde fuera.
  add(corners, normal) {
    const base = this.positions.length / 3;
    for (const c of corners) {
      this.positions.push(...c);
      this.normals.push(...normal);
    }
    this.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  top(ix, iz, y) {
    this.add([[ix, y, iz + 1], [ix + 1, y, iz + 1], [ix + 1, y, iz], [ix, y, iz]], [0, 1, 0]);
  }

  toMesh(material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.indices);
    return new THREE.Mesh(geometry, material);
  }
}

// Suelo por celdas: hierba, camino y el cauce del río excavado un bloque, con sus orillas de tierra.
function buildGround(tex) {
  const grass = new QuadBatch();
  const path = new QuadBatch();
  const bed = new QuadBatch();
  const banks = new QuadBatch();
  const y0 = RIVER_BED;

  for (let ix = -HILLS_HALF; ix < HILLS_HALF; ix++) {
    for (let iz = -HILLS_HALF; iz < HILLS_HALF; iz++) {
      if (hillHeight(ix, iz) > 0) continue;
      if (!isRiverCell(ix, iz)) {
        const onPath = Math.abs(ix + 0.5) < PATH.halfWidth && iz >= PATH.zStart && iz < PATH.zEnd;
        (onPath ? path : grass).top(ix, iz, 0);
        continue;
      }
      bed.top(ix, iz, y0);
      // Paredes de tierra hacia cada vecino que no sea río, mirando al agua.
      if (!isRiverCell(ix + 1, iz)) banks.add([[ix + 1, y0, iz], [ix + 1, y0, iz + 1], [ix + 1, 0, iz + 1], [ix + 1, 0, iz]], [-1, 0, 0]);
      if (!isRiverCell(ix - 1, iz)) banks.add([[ix, y0, iz + 1], [ix, y0, iz], [ix, 0, iz], [ix, 0, iz + 1]], [1, 0, 0]);
      if (!isRiverCell(ix, iz + 1)) banks.add([[ix + 1, y0, iz + 1], [ix, y0, iz + 1], [ix, 0, iz + 1], [ix + 1, 0, iz + 1]], [0, 0, -1]);
      if (!isRiverCell(ix, iz - 1)) banks.add([[ix, y0, iz], [ix + 1, y0, iz], [ix + 1, 0, iz], [ix, 0, iz]], [0, 0, 1]);
    }
  }

  const group = new THREE.Group();
  group.add(
    grass.toMesh(new THREE.MeshLambertMaterial({ map: tex.grassTop })),
    path.toMesh(new THREE.MeshLambertMaterial({ map: tex.path })),
    bed.toMesh(new THREE.MeshLambertMaterial({ map: tex.sand })),
    banks.toMesh(new THREE.MeshLambertMaterial({ map: tex.dirt })),
  );
  return group;
}

function instancedBlocks(positions, material) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, positions.length);
  const m = new THREE.Matrix4();
  positions.forEach(([x, y, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, y, z)));
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function buildHills(tex) {
  const grass = [];
  const dirt = [];
  for (let ix = -HILLS_HALF; ix < HILLS_HALF; ix++) {
    for (let iz = -HILLS_HALF; iz < HILLS_HALF; iz++) {
      const h = hillHeight(ix, iz);
      if (h === 0) continue;
      // Solo los bloques que asoman por encima del vecino más bajo son visibles.
      let lowest = h;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = ix + dx, nz = iz + dz;
        if (Math.abs(nx + 0.5) > HILLS_HALF || Math.abs(nz + 0.5) > HILLS_HALF) continue;
        lowest = Math.min(lowest, hillHeight(nx, nz));
      }
      grass.push([ix + 0.5, h - 0.5, iz + 0.5]);
      for (let k = h - 1; k > lowest; k--) dirt.push([ix + 0.5, k - 0.5, iz + 0.5]);
    }
  }
  const side = new THREE.MeshLambertMaterial({ map: tex.grassSide });
  const top = new THREE.MeshLambertMaterial({ map: tex.grassTop });
  const soil = new THREE.MeshLambertMaterial({ map: tex.dirt });
  const group = new THREE.Group();
  group.add(instancedBlocks(grass, [side, side, top, soil, side, side]));
  if (dirt.length) group.add(instancedBlocks(dirt, soil));
  return group;
}

// Mangos instanciados; el color por instancia va de verde (sin madurar) a rojizo.
function buildMangoes(fruits, tex, rng) {
  const geometry = new THREE.BoxGeometry(0.3, 0.42, 0.3);
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ map: tex.mango }), fruits.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const tint = new THREE.Color();
  fruits.forEach(({ x, y, z, fallen }, i) => {
    euler.set(fallen ? Math.PI / 2 : (rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
    m.compose(pos.set(x, y, z), q.setFromEuler(euler), scl.setScalar(0.85 + rng() * 0.35));
    mesh.setMatrixAt(i, m);
    const ripeness = rng();
    mesh.setColorAt(i, ripeness < 0.2 ? tint.setRGB(0.55, 0.85, 0.35) : tint.setRGB(1, 0.8 + ripeness * 0.2, 0.75 + ripeness * 0.25));
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Árboles de mango: tronco corto y copa ancha, densa y redondeada, con la fruta
// colgando por debajo. Dos van fijos junto a la casita; el resto, repartidos por el campo.
function buildMangoTrees(tex, rng) {
  const spots = [
    { x: -15.5, z: 3.5, height: 5 },
    { x: 15.5, z: -7.5, height: 4 },
  ];
  let attempts = 0;
  while (spots.length < 11 && attempts++ < 400) {
    const x = Math.round((rng() * 2 - 1) * 41) + 0.5;
    const z = Math.round((rng() * 2 - 1) * 41) + 0.5;
    if (Math.hypot(x, z) < 24) continue;
    if (z > 0 && Math.abs(x) < 7) continue; // no tapar la vista del camino
    if (riverDistance(x, z) < RIVER_HALF + 5) continue; // ni crecer dentro del río
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 12)) continue;
    spots.push({ x, z, height: 4 + Math.floor(rng() * 2) });
  }

  const trunks = [];
  const leaves = [];
  const fruits = [];
  for (const { x, z, height } of spots) {
    for (let y = 0; y < height + 2; y++) trunks.push([x, y + 0.5, z]);

    const reach = 3.3 + rng() * 0.6;
    const rise = 2.6;
    const centerY = height + 2;
    const inCanopy = (dx, dy, dz) => {
      const bumps = valueNoise((x + dx) * 0.7, (z + dz) * 0.7 + dy * 1.3, 17) * 0.35;
      return (dx / reach) ** 2 + (dy / rise) ** 2 + (dz / reach) ** 2 <= 0.8 + bumps;
    };
    const R = Math.ceil(reach) + 1;
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        for (let dy = -3; dy <= 3; dy++) {
          if (!inCanopy(dx, dy, dz)) continue;
          // El interior de la copa no se ve: solo se dibuja la cáscara.
          const buried =
            inCanopy(dx + 1, dy, dz) && inCanopy(dx - 1, dy, dz) && inCanopy(dx, dy + 1, dz) &&
            inCanopy(dx, dy - 1, dz) && inCanopy(dx, dy, dz + 1) && inCanopy(dx, dy, dz - 1);
          const onTrunk = dx === 0 && dz === 0 && dy < 0;
          if (!buried && !onTrunk) leaves.push([x + dx, centerY + dy + 0.5, z + dz]);

          const underside = !inCanopy(dx, dy - 1, dz) && (dx !== 0 || dz !== 0);
          if (underside && rng() < 0.22) {
            fruits.push({ x: x + dx + (rng() - 0.5) * 0.5, y: centerY + dy - 0.26, z: z + dz + (rng() - 0.5) * 0.5 });
          }
        }
      }
    }
    // Algunos mangos ya cayeron al pie del árbol.
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      const r = 1.2 + rng() * 2.2;
      fruits.push({ x: x + Math.cos(a) * r, y: 0.15, z: z + Math.sin(a) * r, fallen: true });
    }
  }

  const group = new THREE.Group();
  group.add(instancedBlocks(trunks, new THREE.MeshLambertMaterial({ map: tex.log })));
  group.add(instancedBlocks(leaves, new THREE.MeshLambertMaterial({ map: tex.leaves })));
  group.add(buildMangoes(fruits, tex, rng));
  const colliders = spots.map(({ x, z }) => footprint([x - 0.5, 0, z - 0.5], [x + 0.5, 0, z + 0.5]));
  return { group, spots, colliders };
}

export function createTerrain() {
  const tex = getTextures();
  const group = new THREE.Group();
  group.add(buildGround(tex), buildHills(tex));

  const trees = buildMangoTrees(tex, mulberry32(2024));
  group.add(trees.group);

  return { group, colliders: trees.colliders, treeSpots: trees.spots };
}
