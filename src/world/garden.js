import * as THREE from 'three';
import { mulberry32 } from '../util/random.js';
import { getTextures } from './textures.js';
import { tiledBox, footprint, mergeStatic } from './blocks.js';
import { plantFlowers } from './flowers.js';
import { GARDEN, HOUSE } from './layout.js';
import { RIVER_HALF, riverZ } from './river.js';

// Una variedad por surco, de la casa hacia la cerca.
const ROWS = ['lavender', 'pinkTulip', 'daisy', 'poppy', 'allium', 'orangeTulip', 'cornflower', 'dandelion', 'pinkTulip', 'lavender'];
const BED = { x0: 2.6, x1: 9.6, z0: HOUSE.halfZ + 1.6, z1: GARDEN.zEnd - 1 };
const PLANTER = { x0: 4, x1: 6, y: 0.95, depth: 0.45 }; // jardineras bajo las ventanas de la fachada

export function createGarden() {
  const tex = getTextures();
  const rng = mulberry32(77);
  const wood = new THREE.MeshLambertMaterial({ map: tex.planks });
  const logs = new THREE.MeshLambertMaterial({ map: tex.log });
  const soil = new THREE.MeshLambertMaterial({ map: tex.mulch });

  const pieces = new THREE.Group();
  const colliders = [];
  const plants = [];

  // Tramo de cerca recto entre dos puntos, con postes cada ~1,5 bloques y dos travesaños.
  function fence(x0, z0, x1, z1) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const posts = Math.max(1, Math.round(length / 1.5));
    for (let i = 0; i <= posts; i++) {
      const x = x0 + ((x1 - x0) * i) / posts;
      const z = z0 + ((z1 - z0) * i) / posts;
      pieces.add(tiledBox([x - 0.12, 0, z - 0.12], [x + 0.12, 1.05, z + 0.12], logs));
    }
    const min = [Math.min(x0, x1) - 0.06, 0, Math.min(z0, z1) - 0.06];
    const max = [Math.max(x0, x1) + 0.06, 0, Math.max(z0, z1) + 0.06];
    for (const y of [0.4, 0.8]) pieces.add(tiledBox([min[0], y, min[2]], [max[0], y + 0.13, max[2]], wood));
    colliders.push(footprint(min, max));
  }

  const { halfX, zStart, zEnd, gateHalf } = GARDEN;
  for (const s of [-1, 1]) {
    fence(s * HOUSE.halfX, zStart, s * halfX, zStart);
    fence(s * halfX, zStart, s * halfX, zEnd);
    fence(s * halfX, zEnd, s * gateHalf, zEnd);
    // Poste alto de la entrada.
    pieces.add(tiledBox([s * gateHalf - 0.15, 0, zEnd - 0.15], [s * gateHalf + 0.15, 2.6, zEnd + 0.15], logs));
  }
  pieces.add(tiledBox([-gateHalf - 0.4, 2.6, zEnd - 0.2], [gateHalf + 0.4, 2.85, zEnd + 0.2], wood));

  for (const s of [-1, 1]) {
    const span = (a, b) => (s === 1 ? [a, b] : [-b, -a]);

    // Bancal de tierra con bordillo de troncos.
    const [bx0, bx1] = span(BED.x0, BED.x1);
    pieces.add(tiledBox([bx0, -0.1, BED.z0], [bx1, 0.04, BED.z1], soil));
    pieces.add(tiledBox([bx0 - 0.2, 0, BED.z0 - 0.2], [bx1 + 0.2, 0.16, BED.z0], logs));
    pieces.add(tiledBox([bx0 - 0.2, 0, BED.z1], [bx1 + 0.2, 0.16, BED.z1 + 0.2], logs));
    pieces.add(tiledBox([bx0 - 0.2, 0, BED.z0], [bx0, 0.16, BED.z1], logs));
    pieces.add(tiledBox([bx1, 0, BED.z0], [bx1 + 0.2, 0.16, BED.z1], logs));

    const rowGap = (BED.z1 - BED.z0) / ROWS.length;
    ROWS.forEach((kind, row) => {
      const z = BED.z0 + rowGap * (row + 0.5);
      for (let x = bx0 + 0.35; x < bx1 - 0.2; x += 0.56) {
        plants.push({
          kind, x: x + (rng() - 0.5) * 0.2, y: 0.04, z: z + (rng() - 0.5) * 0.2,
          size: 0.75 + rng() * 0.3, turn: rng() * Math.PI,
        });
      }
    });

    // Jardinera bajo la ventana.
    const [px0, px1] = span(PLANTER.x0, PLANTER.x1);
    const pz = HOUSE.halfZ;
    pieces.add(tiledBox([px0, PLANTER.y - 0.4, pz], [px1, PLANTER.y, pz + PLANTER.depth], wood));
    pieces.add(tiledBox([px0 + 0.06, PLANTER.y, pz + 0.06], [px1 - 0.06, PLANTER.y + 0.02, pz + PLANTER.depth - 0.06], soil));
    for (let i = 0; i < 6; i++) {
      plants.push({
        kind: ['poppy', 'daisy', 'dandelion'][i % 3], x: px0 + 0.25 + i * 0.3, y: PLANTER.y, z: pz + PLANTER.depth / 2,
        size: 0.55, turn: rng() * Math.PI,
      });
    }
  }

  // Flores silvestres salpicando las orillas del río.
  const wild = ['poppy', 'daisy', 'cornflower', 'dandelion', 'allium'];
  for (let i = 0; i < 110; i++) {
    const x = (rng() * 2 - 1) * 46;
    if (Math.abs(x) < 2.5) continue;
    const side = rng() < 0.5 ? -1 : 1;
    const z = riverZ(x) + side * (RIVER_HALF + 0.5 + rng() * 1.6);
    plants.push({ kind: wild[Math.floor(rng() * wild.length)], x, y: 0, z, size: 0.7 + rng() * 0.3, turn: rng() * Math.PI });
  }

  const group = new THREE.Group();
  group.add(mergeStatic(pieces), plantFlowers(plants));
  return { group, colliders };
}
