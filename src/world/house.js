import * as THREE from 'three';
import { getTextures } from './textures.js';
import { tiledBox, footprint } from './blocks.js';
import { HOUSE } from './layout.js';

const { halfX: HX, halfZ: HZ, wallHeight: WALL, doorHalf: DOOR, doorHeight: DOOR_H } = HOUSE;
const STONE = 1; // altura del zócalo de piedra
const WINDOW = { x0: 2, x1: 4, y0: 1, y1: 3 }; // ventanas de la fachada (la izquierda es su espejo)

export function createHouse() {
  const tex = getTextures();
  const mat = {
    planks: new THREE.MeshLambertMaterial({ map: tex.planks }),
    roof: new THREE.MeshLambertMaterial({ map: tex.darkPlanks }),
    cobble: new THREE.MeshLambertMaterial({ map: tex.cobble }),
    log: new THREE.MeshLambertMaterial({ map: tex.log }),
    glass: new THREE.MeshLambertMaterial({ map: tex.glass, transparent: true, side: THREE.DoubleSide }),
    lantern: new THREE.MeshBasicMaterial({ map: tex.lantern }),
    chain: new THREE.MeshLambertMaterial({ color: 0x3a3a40 }),
    heart: new THREE.MeshBasicMaterial({ map: tex.heart, transparent: true, alphaTest: 0.5 }),
    rug: new THREE.MeshLambertMaterial({ map: tex.rug }),
  };

  const group = new THREE.Group();
  const colliders = [];
  const add = (min, max, material, solid = false) => {
    group.add(tiledBox(min, max, material));
    if (solid) colliders.push(footprint(min, max));
  };
  // Muro con zócalo de piedra abajo y tablones arriba.
  const wall = (x0, z0, x1, z1) => {
    add([x0, 0, z0], [x1, STONE, z1], mat.cobble, true);
    add([x0, STONE, z0], [x1, WALL, z1], mat.planks);
  };

  // El suelo acaba a media pared para no asomar por fuera; el escalón cubre el umbral.
  add([-HX + 0.5, -0.2, -HZ + 0.5], [HX - 0.5, 0.02, HZ - 0.5], mat.planks);
  add([-DOOR - 0.5, -0.3, HZ - 0.5], [DOOR + 0.5, 0.04, HZ + 1], mat.cobble);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (HX - 0.5);
      const z = sz * (HZ - 0.5);
      add([x - 0.5, 0, z - 0.5], [x + 0.5, WALL, z + 0.5], mat.log, true);
    }
  }

  wall(-HX + 1, -HZ, HX - 1, -HZ + 1); // fondo
  wall(-HX, -HZ + 1, -HX + 1, HZ - 1); // izquierda
  wall(HX - 1, -HZ + 1, HX, HZ - 1); // derecha

  // Fachada: a cada lado de la puerta, un paño con su ventana.
  for (const s of [-1, 1]) {
    const span = (a, b) => (s === 1 ? [a, b] : [-b, -a]);
    const [edge0, edge1] = span(DOOR, HX - 1);
    const [win0, win1] = span(WINDOW.x0, WINDOW.x1);
    const [jamb0, jamb1] = span(DOOR, WINDOW.x0);
    const [far0, far1] = span(WINDOW.x1, HX - 1);
    add([edge0, 0, HZ - 1], [edge1, STONE, HZ], mat.cobble, true);
    add([jamb0, STONE, HZ - 1], [jamb1, WALL, HZ], mat.planks);
    add([far0, STONE, HZ - 1], [far1, WALL, HZ], mat.planks);
    add([win0, WINDOW.y1, HZ - 1], [win1, WALL, HZ], mat.planks);
    add([win0, WINDOW.y0, HZ - 0.56], [win1, WINDOW.y1, HZ - 0.44], mat.glass);
  }
  add([-DOOR, DOOR_H, HZ - 1], [DOOR, WALL, HZ], mat.planks); // dintel

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

  // Farol colgado de la cumbrera, con luz cálida.
  const ridge = WALL + HZ * 0.5;
  add([-0.04, 4.6, -0.04], [0.04, ridge, 0.04], mat.chain);
  add([-0.25, 4.1, -0.25], [0.25, 4.6, 0.25], mat.lantern);
  const glow = new THREE.PointLight(0xffc37a, 30, 22, 1.8);
  glow.position.set(0, 4, 0);
  group.add(glow);

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.5), mat.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.03, 0);
  group.add(rug);

  const heart = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat.heart);
  heart.position.set(0, DOOR_H + 1, HZ + 0.01);
  group.add(heart);

  return { group, colliders, glow };
}

// Huecos para cuadros en las paredes interiores, en orden de recorrido:
// pared izquierda (de la puerta al fondo), fondo, pared derecha (del fondo a la puerta).
export function frameSlots(rows) {
  const inset = 0.05; // separación de la pared
  const layout =
    rows === 1
      ? { width: 1.9, height: 2.2, centers: [2.55] }
      : { width: 1.9, height: 1.7, centers: [3.55, 1.45] };
  const columns = [];
  for (const z of [2.6, 0, -2.6]) columns.push({ x: -HX + 1 + inset, z, facing: Math.PI / 2 });
  for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) columns.push({ x, z: -HZ + 1 + inset, facing: 0 });
  for (const z of [-2.6, 0, 2.6]) columns.push({ x: HX - 1 - inset, z, facing: -Math.PI / 2 });

  const slots = [];
  for (const column of columns) {
    for (const y of layout.centers) slots.push({ ...column, y, width: layout.width, height: layout.height });
  }
  return slots;
}
