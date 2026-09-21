import * as THREE from 'three';
import { mulberry32, valueNoise } from '../util/random.js';
import { getTextures } from './textures.js';
import { footprint, instancedBlocks } from './blocks.js';
import { instancedFruit } from './fruit.js';
import { WORLD_HALF } from './layout.js';
import { RIVER_HALF, riverDistance } from './river.js';

// Árbol de copa redondeada hecha de bloques (mango, higuera). Rellena las listas de troncos,
// hojas y frutos; los frutos cuelgan bajo la copa y algunos ya cayeron al suelo.
function growCanopyTree({ x, z, height, reach, rise, fruitChance, fruitDrop, fallen }, rng, out) {
  const centerY = height + 2;
  for (let y = 0; y < centerY; y++) out.trunks.push([x, y + 0.5, z]);

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
        if (!buried && !onTrunk) out.leaves.push([x + dx, centerY + dy + 0.5, z + dz]);

        const underside = !inCanopy(dx, dy - 1, dz) && (dx !== 0 || dz !== 0);
        if (underside && rng() < fruitChance) {
          out.fruits.push({
            x: x + dx + (rng() - 0.5) * 0.5, y: centerY + dy - fruitDrop, z: z + dz + (rng() - 0.5) * 0.5,
            rx: (rng() - 0.5) * 0.3, ry: rng() * Math.PI * 2, rz: (rng() - 0.5) * 0.3,
          });
        }
      }
    }
  }
  for (let i = 0; i < fallen; i++) {
    const a = rng() * Math.PI * 2;
    const r = 1.2 + rng() * 2.2;
    out.fruits.push({ x: x + Math.cos(a) * r, y: 0.13, z: z + Math.sin(a) * r, rx: Math.PI / 2, ry: rng() * 6 });
  }
}

// Mangos: tronco corto y copa ancha y densa. Dos fijos junto a la casita, el resto repartidos.
function mangoTrees(tex, rng, taken) {
  const spots = [
    { x: -15.5, z: 3.5, height: 4 },
    { x: 15.5, z: -7.5, height: 3 },
  ];
  let attempts = 0;
  const span = WORLD_HALF - 7;
  while (spots.length < 15 && attempts++ < 600) {
    const x = Math.round((rng() * 2 - 1) * span) + 0.5;
    const z = Math.round((rng() * 2 - 1) * span) + 0.5;
    if (Math.hypot(x, z) < 27) continue;
    if (z > 0 && Math.abs(x) < 7) continue; // no tapar la vista del camino
    if (riverDistance(x, z) < RIVER_HALF + 5) continue; // ni crecer dentro del río
    if ([...spots, ...taken].some((s) => Math.hypot(s.x - x, s.z - z) < 12)) continue;
    spots.push({ x, z, height: 3 + Math.floor(rng() * 2) });
  }

  const out = { trunks: [], leaves: [], fruits: [] };
  for (const spot of spots) {
    growCanopyTree({ ...spot, reach: 3.3 + rng() * 0.6, rise: 2.6, fruitChance: 0.22, fruitDrop: 0.26, fallen: 3 }, rng, out);
  }
  // El tinte va de verde (sin madurar) a rojizo.
  for (const fruit of out.fruits) {
    const ripeness = rng();
    fruit.scale = 0.85 + rng() * 0.35;
    fruit.color = ripeness < 0.2
      ? new THREE.Color(0.55, 0.85, 0.35)
      : new THREE.Color(1, 0.8 + ripeness * 0.2, 0.75 + ripeness * 0.25);
  }

  const group = new THREE.Group();
  const fruit = instancedFruit(new THREE.BoxGeometry(0.3, 0.42, 0.3), new THREE.MeshLambertMaterial({ map: tex.mango }), out.fruits);
  group.add(
    instancedBlocks(out.trunks, new THREE.MeshLambertMaterial({ map: tex.log })),
    instancedBlocks(out.leaves, new THREE.MeshLambertMaterial({ map: tex.leaves })),
    fruit,
  );
  return { group, spots, edible: [[fruit, 'mango']] };
}

// La higuera: baja y ancha, de hoja más clara, junto al jardín.
function figTree(tex, rng) {
  const spot = { x: 15.5, z: 11.5 };
  const out = { trunks: [], leaves: [], fruits: [] };
  growCanopyTree({ ...spot, height: 2, reach: 3.4, rise: 2.3, fruitChance: 0.3, fruitDrop: 0.2, fallen: 4 }, rng, out);
  for (const fruit of out.fruits) fruit.scale = 0.9 + rng() * 0.3;

  const group = new THREE.Group();
  const fruit = instancedFruit(new THREE.BoxGeometry(0.2, 0.24, 0.2), new THREE.MeshLambertMaterial({ map: tex.fig }), out.fruits);
  group.add(
    instancedBlocks(out.trunks, new THREE.MeshLambertMaterial({ map: tex.log })),
    instancedBlocks(out.leaves, new THREE.MeshLambertMaterial({ map: tex.figLeaves })),
    fruit,
  );
  return { group, spots: [spot], edible: [[fruit, 'higo']] };
}

// Papayos: tronco fino y alto sin ramas, un penacho de hojas palmeadas arriba y las papayas
// apiñadas contra el tronco justo debajo.
function papayaTrees(tex, rng) {
  const spots = [
    { x: -12.5, z: -10.5 }, { x: -13.5, z: -14.5 }, { x: -12.5, z: -18.5 },
    { x: 12.5, z: -14.5 }, { x: 13.5, z: -18.5 },
    { x: 5.5, z: 18.5 }, { x: -5.5, z: 31.5 },
  ];
  const trunks = [];
  const leaves = [];
  const fruits = [];
  for (const spot of spots) {
    const height = 3 + Math.floor(rng() * 2); // bajitos: las papayas quedan al alcance de la mano
    for (let y = 0; y < height; y++) trunks.push([spot.x, y + 0.5, spot.z]);

    const count = 9;
    for (let i = 0; i < count; i++) {
      // Corona: hojas caídas alrededor y unas pocas más erguidas en lo alto.
      const ry = (i / count) * Math.PI * 2 + rng() * 0.3;
      leaves.push({ x: spot.x, y: height - 0.1, z: spot.z, ry, rx: 0.35 + rng() * 0.3, scale: 0.9 + rng() * 0.3 });
      if (i % 3 === 0) leaves.push({ x: spot.x, y: height, z: spot.z, ry: ry + 0.5, rx: -0.6, scale: 0.75 });
    }
    const bunch = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < bunch; i++) {
      const a = (i / bunch) * Math.PI * 2 + rng();
      fruits.push({
        x: spot.x + Math.cos(a) * 0.36, y: height - 0.55 - (i % 2) * 0.4, z: spot.z + Math.sin(a) * 0.36,
        ry: -a, rz: 0.2, scale: 0.85 + rng() * 0.35,
        color: rng() < 0.35 ? 0x9fce5a : 0xffffff, // algunas aún verdes
      });
    }
  }

  // Hoja plana que sale del tronco hacia +Z; la inclinación (rx) la hace caer o levantarse.
  const leaf = new THREE.PlaneGeometry(1.5, 2.3);
  leaf.rotateX(Math.PI / 2);
  leaf.translate(0, 0, 1.15);
  const leafMaterial = new THREE.MeshLambertMaterial({ map: tex.papayaLeaf, alphaTest: 0.5, side: THREE.DoubleSide });
  const leafMesh = new THREE.InstancedMesh(leaf, leafMaterial, leaves.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  leaves.forEach((l, i) => {
    euler.set(l.rx, l.ry, 0);
    leafMesh.setMatrixAt(i, m.compose(pos.set(l.x, l.y, l.z), q.setFromEuler(euler), scl.setScalar(l.scale)));
  });

  const group = new THREE.Group();
  const fruit = instancedFruit(new THREE.BoxGeometry(0.26, 0.46, 0.26), new THREE.MeshLambertMaterial({ map: tex.papaya }), fruits);
  group.add(instancedBlocks(trunks, new THREE.MeshLambertMaterial({ map: tex.papayaTrunk }), [0.42, 1, 0.42]), leafMesh, fruit);
  return { group, spots, edible: [[fruit, 'papaya']] };
}

export function createTrees() {
  const tex = getTextures();
  const rng = mulberry32(2024);
  const fig = figTree(tex, rng);
  const papayas = papayaTrees(tex, rng);
  const mangoes = mangoTrees(tex, rng, [...fig.spots, ...papayas.spots]);

  const group = new THREE.Group();
  group.add(mangoes.group, fig.group, papayas.group);
  const spots = [...mangoes.spots, ...fig.spots, ...papayas.spots];
  return {
    group,
    spots,
    colliders: spots.map(({ x, z }) => footprint([x - 0.5, 0, z - 0.5], [x + 0.5, 0, z + 0.5])),
    edible: [...mangoes.edible, ...fig.edible, ...papayas.edible],
  };
}
