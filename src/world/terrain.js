import * as THREE from 'three';
import { valueNoise } from '../util/random.js';
import { getTextures } from './textures.js';
import { instancedBlocks } from './blocks.js';
import { WORLD_HALF, HILLS_HALF, PATH, HUERTO } from './layout.js';
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
        // El camino de la entrada y el caminito que cruza el huerto desde la puerta trasera.
        const onPath = Math.abs(ix + 0.5) < PATH.halfWidth
          && ((iz >= PATH.zStart && iz < PATH.zEnd) || (iz < HUERTO.zNear && iz >= HUERTO.zFar - 2));
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

export function createTerrain() {
  const tex = getTextures();
  const group = new THREE.Group();
  group.add(buildGround(tex), buildHills(tex));
  return { group };
}
