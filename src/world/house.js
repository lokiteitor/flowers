import * as THREE from 'three';
import { getTextures } from './textures.js';
import { tiledBox, footprint, mergeStatic } from './blocks.js';
import { HOUSE } from './layout.js';
import { furnish } from './furniture.js';

const { halfX: HX, halfZ: HZ, wallHeight: WALL, doorHalf: DOOR, doorHeight: DOOR_H } = HOUSE;
const STONE = 1; // altura del zócalo de piedra de los muros exteriores
const HEADROOM = 1.8; // una pieza que empieza por encima no estorba al jugador

// Planta (interior de -8…8 en X y -6…6 en Z, puerta en +Z):
//   · comedor delante a la izquierda, cocina al fondo a la izquierda,
//   · dormitorio a la derecha, tras un tabique en x = 2…3 con su hueco de paso.
const PARTITION = { x0: 2, x1: 3, door: [1, 3] };

export function createHouse() {
  const tex = getTextures();
  const mat = {
    planks: new THREE.MeshLambertMaterial({ map: tex.planks }),
    roof: new THREE.MeshLambertMaterial({ map: tex.darkPlanks }),
    cobble: new THREE.MeshLambertMaterial({ map: tex.cobble }),
    log: new THREE.MeshLambertMaterial({ map: tex.log }),
    glass: new THREE.MeshLambertMaterial({ map: tex.glass, transparent: true, side: THREE.DoubleSide }),
    tile: new THREE.MeshLambertMaterial({ map: tex.tile }),
  };

  const pieces = new THREE.Group();
  const colliders = [];
  const add = (min, max, material, solid = false) => {
    pieces.add(tiledBox(min, max, material));
    if (solid) colliders.push(footprint(min, max));
  };

  // Muro recto con huecos. axis 'x': corre a lo largo de X ocupando z = c0…c1; 'z', al revés.
  // Cada hueco es { a0, a1, y0, y1, glass }: se rellena por debajo y por encima.
  function wallRun(axis, c0, c1, from, to, openings = [], { stone = true } = {}) {
    const box = (a0, a1, y0, y1, material, solid, inset = 0) => {
      const min = axis === 'x' ? [a0, y0, c0 + inset] : [c0 + inset, y0, a0];
      const max = axis === 'x' ? [a1, y1, c1 - inset] : [c1 - inset, y1, a1];
      add(min, max, material, solid);
    };
    const fill = (a0, a1, y0, y1) => {
      if (a1 <= a0 || y1 <= y0) return;
      const split = stone ? Math.min(Math.max(STONE, y0), y1) : y0;
      if (split > y0) box(a0, a1, y0, split, mat.cobble, y0 < HEADROOM);
      if (y1 > split) box(a0, a1, split, y1, mat.planks, split === y0 && y0 < HEADROOM);
    };
    let cursor = from;
    for (const o of [...openings].sort((p, q) => p.a0 - q.a0)) {
      fill(cursor, o.a0, 0, WALL);
      fill(o.a0, o.a1, 0, o.y0);
      fill(o.a0, o.a1, o.y1, WALL);
      if (o.glass) box(o.a0, o.a1, o.y0, o.y1, mat.glass, false, (c1 - c0) / 2 - 0.06);
      cursor = o.a1;
    }
    fill(cursor, to, 0, WALL);
  }
  const windowAt = (a0, a1, y0 = 1, y1 = 3) => ({ a0, a1, y0, y1, glass: true });
  const doorway = (a0, a1) => ({ a0, a1, y0: 0, y1: DOOR_H });

  // El suelo acaba a media pared para no asomar por fuera; el escalón cubre el umbral.
  add([-HX + 0.5, -0.2, -HZ + 0.5], [HX - 0.5, 0.02, HZ - 0.5], mat.planks);
  add([-HX + 1, 0, -HZ + 1], [-1, 0.035, -2], mat.tile); // baldosas de la cocina
  add([-DOOR - 0.5, -0.3, HZ - 0.5], [DOOR + 0.5, 0.04, HZ + 1], mat.cobble);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (HX - 0.5);
      const z = sz * (HZ - 0.5);
      add([x - 0.5, 0, z - 0.5], [x + 0.5, WALL, z + 0.5], mat.log, true);
    }
  }

  wallRun('x', -HZ, -HZ + 1, -HX + 1, HX - 1, [windowAt(-7, -5, 2, 3)]); // fondo: ventana sobre el fregadero
  wallRun('x', HZ - 1, HZ, -HX + 1, HX - 1, [windowAt(-6, -4), doorway(-DOOR, DOOR), windowAt(4, 6)]);
  wallRun('z', -HX, -HX + 1, -HZ + 1, HZ - 1, [windowAt(1, 3)]);
  wallRun('z', HX - 1, HX, -HZ + 1, HZ - 1, [windowAt(-1, 1)]);
  wallRun('z', PARTITION.x0, PARTITION.x1, -HZ + 1, HZ - 1, [doorway(...PARTITION.door)], { stone: false });

  // Tejado a dos aguas en escalones de medio bloque, con alero de un bloque.
  for (let k = 0; k <= HZ; k++) {
    const y0 = WALL - 0.5 + k * 0.5;
    add([-HX - 1, y0, HZ - k], [HX + 1, y0 + 1, HZ + 1 - k], mat.roof);
    add([-HX - 1, y0, -HZ - 1 + k], [HX + 1, y0 + 1, -HZ + k], mat.roof);
  }
  // Hastiales: rellenan el triángulo bajo el tejado en los dos extremos.
  for (let j = 0; j < HZ; j++) {
    const y0 = WALL + j * 0.5;
    add([-HX, y0, -HZ + j], [-HX + 1, y0 + 0.5, HZ - j], mat.planks);
    add([HX - 1, y0, -HZ + j], [HX, y0 + 0.5, HZ - j], mat.planks);
  }

  const furniture = furnish(pieces, colliders);

  const group = new THREE.Group();
  group.add(mergeStatic(pieces), furniture.extras);
  return { group, colliders, frameSlots: furniture.frameSlots, letter: furniture.letter };
}
