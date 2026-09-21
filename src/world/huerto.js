import * as THREE from 'three';
import { mulberry32 } from '../util/random.js';
import { getTextures } from './textures.js';
import { tiledBox, mergeStatic } from './blocks.js';
import { fenceBuilder } from './fence.js';
import { plantFlowers } from './flowers.js';
import { instancedFruit } from './fruit.js';
import { HOUSE, HUERTO } from './layout.js';

// Un surco por cultivo, de la casa hacia el fondo. `z` es el centro del surco.
const ROWS = [
  { crop: 'chile', z: -10 },
  { crop: 'tomate', z: -12 },
  { crop: 'acelga', z: -14 },
  { crop: 'melón', z: -16 },
  { crop: 'calabacita', z: -18 },
];
const BED = { x0: 1.9, x1: 9.3, depth: 1.5 };

export function createHuerto() {
  const tex = getTextures();
  const rng = mulberry32(314);
  const lambert = (map) => new THREE.MeshLambertMaterial({ map });
  const wood = lambert(tex.planks);
  const logs = lambert(tex.log);
  const soil = lambert(tex.mulch);

  const pieces = new THREE.Group();
  const colliders = [];
  const fence = fenceBuilder(pieces, colliders, { posts: logs, rails: wood });

  // Cerca: sale de las esquinas traseras de la casa y deja un paso al fondo, hacia el campo.
  const { halfX, zNear, zFar, gateHalf } = HUERTO;
  for (const s of [-1, 1]) {
    fence(s * HOUSE.halfX, zNear, s * halfX, zNear);
    fence(s * halfX, zNear, s * halfX, zFar);
    fence(s * halfX, zFar, s * gateHalf, zFar);
  }

  const plants = []; // matas (planos cruzados)
  const chard = []; // las acelgas se comen enteras, así que van aparte
  const fruits = { chile: [], tomate: [], melón: [], calabacita: [] };

  for (const { crop, z } of ROWS) {
    for (const s of [-1, 1]) {
      const x0 = s === 1 ? BED.x0 : -BED.x1;
      const x1 = s === 1 ? BED.x1 : -BED.x0;
      pieces.add(tiledBox([x0, -0.1, z - BED.depth / 2], [x1, 0.05, z + BED.depth / 2], soil));

      const step = { chile: 0.9, tomate: 1.15, acelga: 0.7, melón: 1.8, calabacita: 1.4 }[crop];
      for (let x = x0 + 0.5; x < x1 - 0.3; x += step) {
        const px = x + (rng() - 0.5) * 0.15;
        const pz = z + (rng() - 0.5) * 0.3;
        const turn = rng() * Math.PI;
        const around = (radius, y) => {
          const a = rng() * Math.PI * 2;
          return { x: px + Math.cos(a) * radius, y, z: pz + Math.sin(a) * radius, ry: a };
        };

        if (crop === 'chile') {
          plants.push({ kind: 'chileBush', x: px, y: 0.05, z: pz, size: 0.85, turn });
          for (let i = 0; i < 4; i++) {
            fruits.chile.push({ ...around(0.22, 0.28 + rng() * 0.25), rz: 0.25, color: rng() < 0.3 ? 0x3f9a3a : 0xe0261c });
          }
        } else if (crop === 'tomate') {
          plants.push({ kind: 'tomatoBush', x: px, y: 0.05, z: pz, size: 1.25, turn });
          pieces.add(tiledBox([px - 0.03, 0, pz - 0.03], [px + 0.03, 1.4, pz + 0.03], wood)); // tutor
          for (let i = 0; i < 5; i++) {
            fruits.tomate.push({ ...around(0.3, 0.3 + rng() * 0.65), scale: 0.8 + rng() * 0.4, color: rng() < 0.2 ? 0xb7d66a : 0xffffff });
          }
        } else if (crop === 'acelga') {
          chard.push({ kind: 'chard', x: px, y: 0.05, z: pz, size: 0.8 + rng() * 0.2, turn });
        } else if (crop === 'melón') {
          plants.push({ kind: 'melonVine', x: px, y: 0.05, z: pz, size: 1.3, turn });
          fruits.melón.push({ x: px + 0.55, y: 0.27, z: pz + (rng() - 0.5) * 0.4, ry: rng() * 3, scale: 0.85 + rng() * 0.3 });
        } else {
          plants.push({ kind: 'squashBush', x: px, y: 0.05, z: pz, size: 1.15, turn });
          for (let i = 0; i < 2; i++) fruits.calabacita.push({ ...around(0.42, 0.13), scale: 0.85 + rng() * 0.35 });
        }
      }
    }
  }

  const chardGroup = plantFlowers(chard);
  const meshes = {
    chile: instancedFruit(new THREE.BoxGeometry(0.07, 0.22, 0.07), lambert(tex.chile), fruits.chile),
    tomate: instancedFruit(new THREE.BoxGeometry(0.16, 0.15, 0.16), lambert(tex.tomato), fruits.tomate),
    melón: instancedFruit(new THREE.BoxGeometry(0.52, 0.46, 0.52), lambert(tex.melon), fruits.melón),
    calabacita: instancedFruit(new THREE.BoxGeometry(0.5, 0.15, 0.15), lambert(tex.zucchini), fruits.calabacita),
    acelga: chardGroup.children[0],
  };

  const group = new THREE.Group();
  group.add(mergeStatic(pieces), plantFlowers(plants), chardGroup, meshes.chile, meshes.tomate, meshes.melón, meshes.calabacita);
  return { group, colliders, edible: Object.entries(meshes).map(([name, mesh]) => [mesh, name]) };
}
