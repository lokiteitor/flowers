import * as THREE from 'three';
import { mulberry32 } from '../util/random.js';
import { getTextures } from './textures.js';
import { tiledBox, footprint } from './blocks.js';
import { HILLS_HALF, WORLD_HALF } from './layout.js';
import { BRIDGE, RIVER_HALF, RIVER_BED, WATER_LEVEL, bridgeSpan, isRiverCell, riverZ } from './river.js';

// Lámina de agua: un cuadrado por celda de río, con la textura deslizándose río abajo.
function buildWater(tex) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let ix = -HILLS_HALF; ix < HILLS_HALF; ix++) {
    for (let iz = -HILLS_HALF; iz < HILLS_HALF; iz++) {
      if (!isRiverCell(ix, iz)) continue;
      const base = positions.length / 3;
      positions.push(ix, WATER_LEVEL, iz + 1, ix + 1, WATER_LEVEL, iz + 1, ix + 1, WATER_LEVEL, iz, ix, WATER_LEVEL, iz);
      uvs.push(ix, iz + 1, ix + 1, iz + 1, ix + 1, iz, ix, iz); // UV de mundo: la textura casa entre celdas
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const map = tex.water.clone();
  const material = new THREE.MeshLambertMaterial({ map, transparent: true, opacity: 0.58, depthWrite: false });
  return { mesh: new THREE.Mesh(geometry, material), map };
}

function buildLilypads(tex, rng) {
  const spots = [];
  let attempts = 0;
  while (spots.length < 20 && attempts++ < 200) {
    const x = (rng() * 2 - 1) * (WORLD_HALF - 2);
    if (Math.abs(x) < BRIDGE.halfWidth + 1) continue;
    // Pegados a una orilla, donde el agua "corre" menos.
    const side = rng() < 0.5 ? -1 : 1;
    spots.push([x, riverZ(x) + side * (RIVER_HALF - 0.9 - rng() * 0.6)]);
  }
  const geometry = new THREE.PlaneGeometry(0.9, 0.9);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshLambertMaterial({ map: tex.lilypad, alphaTest: 0.5 });
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    m.makeRotationY(rng() * Math.PI * 2).setPosition(x, WATER_LEVEL + 0.02, z);
    mesh.setMatrixAt(i, m);
  });
  return mesh;
}

// Puente de tablones sobre el camino, con barandillas.
function buildBridge(tex) {
  const group = new THREE.Group();
  const colliders = [];
  const planks = new THREE.MeshLambertMaterial({ map: tex.planks });
  const logs = new THREE.MeshLambertMaterial({ map: tex.log });
  const { z0, z1 } = bridgeSpan;
  const w = BRIDGE.halfWidth;

  group.add(tiledBox([-w, BRIDGE.top - 0.25, z0], [w, BRIDGE.top, z1], planks));
  for (const side of [-1, 1]) {
    const x = side * (w - 0.1);
    for (let z = z0; z <= z1; z += (z1 - z0) / 4) {
      group.add(tiledBox([x - 0.12, RIVER_BED, z - 0.12], [x + 0.12, 1.05, z + 0.12], logs));
    }
    group.add(tiledBox([x - 0.07, 0.85, z0], [x + 0.07, 1.0, z1], planks));
    group.add(tiledBox([x - 0.07, 0.45, z0], [x + 0.07, 0.57, z1], planks));
    colliders.push(footprint([x - 0.1, 0, z0], [x + 0.1, 0, z1]));
  }
  return { group, colliders };
}

export function createRiverscape() {
  const tex = getTextures();
  const rng = mulberry32(404);
  const water = buildWater(tex);
  const bridge = buildBridge(tex);

  const group = new THREE.Group();
  group.add(buildLilypads(tex, rng), bridge.group, water.mesh);

  return {
    group,
    colliders: bridge.colliders,
    update(time) {
      water.map.offset.x = -time * 0.35; // la corriente va hacia +X
    },
  };
}
