import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../util/random.js';
import { getTextures } from './textures.js';
import { tiledBox, footprint } from './blocks.js';
import { HILLS_HALF } from './layout.js';
import { BRIDGE, RIVER_HALF, RIVER_BED, WATER_LEVEL, bridgeSpan, isRiverCell, riverFlow, riverZ } from './river.js';

const FISH_COUNT = 34;
const FISH_RANGE = 52; // nadan entre -52 y 52 en X y reaparecen por el otro lado
const FISH_COLORS = [0xff7a1a, 0xffffff, 0xffc21a, 0xff4a2a, 0xffa07a]; // tonos de koi: resaltan bajo el agua

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
  while (spots.length < 16 && attempts++ < 200) {
    const x = (rng() * 2 - 1) * 46;
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

// Pez de bloques mirando a +X: cuerpo, cola y una aleta dorsal.
function fishGeometry() {
  const body = new THREE.BoxGeometry(0.46, 0.2, 0.12);
  const tail = new THREE.BoxGeometry(0.14, 0.24, 0.05);
  tail.translate(-0.3, 0, 0);
  const fin = new THREE.BoxGeometry(0.16, 0.08, 0.04);
  fin.translate(0.02, 0.14, 0);
  return mergeGeometries([body, tail, fin]);
}

function buildFish(rng) {
  // Vistos a través del agua los peces quedaban lavados. Se pintan después de ella (material
  // translúcido + renderOrder) y sin sombreado, como si nadaran justo bajo la superficie.
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8 });
  const mesh = new THREE.InstancedMesh(fishGeometry(), material, FISH_COUNT);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  const color = new THREE.Color();
  const school = [];
  for (let i = 0; i < FISH_COUNT; i++) {
    school.push({
      x: (rng() * 2 - 1) * FISH_RANGE,
      lane: (rng() * 2 - 1) * (RIVER_HALF - 0.8), // desvío lateral respecto al eje del río
      depth: -0.3 - rng() * 0.22, // cerca de la superficie, para que se vean bien desde la orilla
      speed: (0.7 + rng() * 1.1) * (rng() < 0.3 ? -1 : 1), // la mayoría nada río abajo
      size: 1 + rng() * 0.6,
      wiggle: rng() * 10,
      nextJump: 4 + rng() * 40,
      jump: -1, // segundos desde que saltó; -1 = nadando
    });
    mesh.setColorAt(i, color.setHex(FISH_COLORS[i % FISH_COLORS.length]));
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YZX');
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const JUMP_TIME = 0.9;

  function update(dt, time) {
    school.forEach((fish, i) => {
      fish.x += fish.speed * dt;
      if (fish.x > FISH_RANGE) fish.x = -FISH_RANGE;
      if (fish.x < -FISH_RANGE) fish.x = FISH_RANGE;

      // De vez en cuando, un salto fuera del agua.
      fish.nextJump -= dt;
      if (fish.nextJump < 0 && fish.jump < 0) {
        fish.jump = 0;
        fish.nextJump = 12 + Math.random() * 40;
      }
      let y = fish.depth;
      let pitch = 0;
      if (fish.jump >= 0) {
        fish.jump += dt;
        const t = fish.jump / JUMP_TIME;
        if (t >= 1) fish.jump = -1;
        else {
          y = fish.depth + Math.sin(t * Math.PI) * (0.9 - fish.depth);
          pitch = Math.cos(t * Math.PI) * 0.9;
        }
      }

      const [fx, fz] = riverFlow(fish.x);
      const heading = Math.atan2(-fz, fx) + (fish.speed < 0 ? Math.PI : 0);
      const swish = Math.sin(time * 9 + fish.wiggle) * 0.28;
      euler.set(0, heading + swish, pitch);
      pos.set(fish.x, y, riverZ(fish.x) + fish.lane + Math.sin(time * 0.6 + fish.wiggle) * 0.3);
      mesh.setMatrixAt(i, m.compose(pos, q.setFromEuler(euler), scl.setScalar(fish.size)));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, update };
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
  const fish = buildFish(rng);
  const bridge = buildBridge(tex);

  const group = new THREE.Group();
  group.add(fish.mesh, buildLilypads(tex, rng), bridge.group, water.mesh);

  return {
    group,
    colliders: bridge.colliders,
    update(dt, time) {
      water.map.offset.x = -time * 0.35; // la corriente va hacia +X
      fish.update(dt, time);
    },
  };
}
