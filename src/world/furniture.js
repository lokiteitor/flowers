import * as THREE from 'three';
import { mulberry32 } from '../util/random.js';
import { getTextures } from './textures.js';
import { tiledBox, footprint } from './blocks.js';
import { plantFlowers } from './flowers.js';
import { roofUnderside } from './layout.js';

const SIDE_TABLE = 0.8; // altura de las mesitas de los portarretratos
const DINING = { x0: -5.5, x1: -1.5, z0: 0.5, z1: 2.5, top: 0.95 };
// Cine del dormitorio: pantalla 16:9 en el tabique (mirando a +X) y proyector sobre el armario.
const SCREEN = { x: 3.06, y: 2.4, z: -2.3, width: 4.8, height: 2.7 };
const BOOK_COLORS = [0xb03a3a, 0x2f5fa8, 0x3c8a4a, 0xd9a441, 0x7a4aa0, 0xd97a3a, 0x2f8a8a, 0xe8e0cc];

// Amuebla la casita: añade las piezas a `pieces` (que luego se funden por material) y sus
// colisionadores a `colliders`. Devuelve lo que no se puede fundir (luces, flores, la cartita)
// y dónde va cada portarretratos.
export function furnish(pieces, colliders) {
  const tex = getTextures();
  const rng = mulberry32(12);
  const lambert = (map) => new THREE.MeshLambertMaterial({ map });
  const mat = {
    wood: lambert(tex.darkPlanks),
    lightWood: lambert(tex.planks),
    cabinet: lambert(tex.cabinet),
    counter: lambert(tex.counter),
    fridge: lambert(tex.fridge),
    metal: lambert(tex.metal),
    stoveTop: lambert(tex.stoveTop),
    oven: lambert(tex.ovenFront),
    red: lambert(tex.woolRed),
    white: lambert(tex.woolWhite),
    ceramic: lambert(tex.ceramic),
    mango: lambert(tex.mango),
    wicker: lambert(tex.wicker),
    fig: lambert(tex.fig),
    papaya: lambert(tex.papaya),
    tomato: lambert(tex.tomato),
    rug: lambert(tex.rug),
    paper: new THREE.MeshLambertMaterial({ color: 0xf6ecd2 }),
    envelope: lambert(tex.envelope),
    lantern: new THREE.MeshBasicMaterial({ map: tex.lantern }),
    chain: new THREE.MeshLambertMaterial({ color: 0x3a3a40 }),
  };

  const extras = new THREE.Group();
  const frameSlots = [];
  const add = (min, max, material, parent = pieces) => {
    const box = tiledBox(min, max, material);
    parent.add(box);
    return box;
  };
  const solid = (x0, z0, x1, z1) => colliders.push(footprint([x0, 0, z0], [x1, 0, z1]));

  // Mesa de cuatro patas entre dos esquinas en planta.
  function table(x0, z0, x1, z1, top, material = mat.wood) {
    add([x0, top - 0.1, z0], [x1, top, z1], material);
    for (const x of [x0 + 0.08, x1 - 0.2]) {
      for (const z of [z0 + 0.08, z1 - 0.2]) add([x, 0, z], [x + 0.12, top - 0.1, z + 0.12], material);
    }
    solid(x0, z0, x1, z1);
  }

  // Mesita larga pegada a una pared, con un portarretratos por bloque de largo.
  // `facing` es hacia dónde miran las fotos (giro en Y; 0 = +Z).
  function photoTable(x0, z0, x1, z1, facing) {
    table(x0, z0, x1, z1, SIDE_TABLE);
    add([x0 + 0.1, 0.25, z0 + 0.1], [x1 - 0.1, 0.31, z1 - 0.1], mat.wood); // balda inferior
    const alongX = x1 - x0 > z1 - z0;
    const count = Math.round(alongX ? x1 - x0 : z1 - z0);
    for (let i = 0; i < count; i++) {
      frameSlots.push({
        x: alongX ? x0 + (i + 0.5) * ((x1 - x0) / count) : (x0 + x1) / 2,
        z: alongX ? (z0 + z1) / 2 : z0 + (i + 0.5) * ((z1 - z0) / count),
        y: SIDE_TABLE,
        facing,
      });
    }
  }

  function chair(x, z, facing) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = facing;
    add([-0.3, 0.45, -0.3], [0.3, 0.55, 0.3], mat.lightWood, group);
    add([-0.3, 0.55, -0.3], [0.3, 1.25, -0.2], mat.lightWood, group); // respaldo, detrás de quien se sienta
    for (const lx of [-0.3, 0.2]) for (const lz of [-0.3, 0.2]) add([lx, 0, lz], [lx + 0.1, 0.45, lz + 0.1], mat.lightWood, group);
    pieces.add(group);
    solid(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  }

  function rugAt(x, z, width, depth) {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat.rug);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(x, 0.045, z);
    pieces.add(rug);
  }

  function lantern(x, z, intensity) {
    add([x - 0.04, 3.3, z - 0.04], [x + 0.04, roofUnderside(z), z + 0.04], mat.chain);
    add([x - 0.22, 2.85, z - 0.22], [x + 0.22, 3.3, z + 0.22], mat.lantern);
    const light = new THREE.PointLight(0xffc37a, intensity, 16, 1.8);
    light.position.set(x, 2.7, z);
    extras.add(light);
    return light;
  }

  // Librero contra una pared que mira a +X: armazón, baldas y libros de lomos de colores.
  function bookshelf(x0, z0, z1, height) {
    const depth = 0.7;
    add([x0, 0, z0], [x0 + 0.06, height, z1], mat.wood); // trasera
    add([x0, 0, z0], [x0 + depth, height, z0 + 0.1], mat.wood);
    add([x0, 0, z1 - 0.1], [x0 + depth, height, z1], mat.wood);
    const bookMaterials = BOOK_COLORS.map((color) => new THREE.MeshLambertMaterial({ color }));
    const shelves = Math.floor(height / 0.62);
    for (let i = 0; i <= shelves; i++) {
      const y = Math.min(i * 0.62, height - 0.08);
      add([x0, y, z0], [x0 + depth, y + 0.08, z1], mat.wood);
      if (i === shelves) break;
      // Libros de pie, con algún hueco y alguno recostado contra los demás.
      let z = z0 + 0.14;
      while (z < z1 - 0.3) {
        const thick = 0.07 + rng() * 0.09;
        const tall = 0.32 + rng() * 0.16;
        if (rng() < 0.12) {
          z += 0.18; // hueco
          continue;
        }
        const book = tiledBox([x0 + 0.12, y + 0.08, z], [x0 + 0.12 + 0.36 + rng() * 0.12, y + 0.08 + tall, z + thick], bookMaterials[Math.floor(rng() * bookMaterials.length)]);
        pieces.add(book);
        z += thick + 0.012;
      }
    }
    solid(x0, z0, x0 + depth, z1);
  }

  // --- Comedor ---------------------------------------------------------------------
  table(DINING.x0, DINING.z0, DINING.x1, DINING.z1, DINING.top);
  for (const x of [-4.5, -2.5]) {
    chair(x, DINING.z0 - 0.2, 0);
    chair(x, DINING.z1 + 0.2, Math.PI);
  }
  rugAt(-3.5, 1.5, 6, 4.4);
  lantern(-3.5, 1.5, 22);

  // Florero con flores amarillas en el centro de la mesa…
  const vaseX = -3.7;
  const vaseZ = 1.5;
  add([vaseX - 0.14, DINING.top, vaseZ - 0.14], [vaseX + 0.14, DINING.top + 0.3, vaseZ + 0.14], mat.ceramic);
  add([vaseX - 0.09, DINING.top + 0.3, vaseZ - 0.09], [vaseX + 0.09, DINING.top + 0.4, vaseZ + 0.09], mat.ceramic);
  const bouquet = [];
  const yellows = ['dandelion', 'yellowTulip', 'dandelion', 'yellowTulip', 'dandelion', 'dandelion', 'yellowTulip'];
  yellows.forEach((kind, i) => {
    // La primera va recta en el centro; las demás se abren en abanico (el giro en Y se aplica
    // después de la inclinación, así que basta inclinar todas hacia su propio "delante").
    bouquet.push({
      kind, x: vaseX, y: DINING.top + 0.18, z: vaseZ, size: 0.62 + rng() * 0.14,
      turn: (i / yellows.length) * Math.PI * 2, tiltX: i === 0 ? 0 : 0.34,
    });
  });
  extras.add(plantFlowers(bouquet));

  // …una canasta de frutas al otro lado, que se pueden comer una a una…
  const bx = -4.7;
  const bz = 1.5;
  const top = DINING.top;
  add([bx - 0.4, top, bz - 0.28], [bx + 0.4, top + 0.2, bz + 0.28], mat.wicker);
  for (const side of [-1, 1]) add([bx + side * 0.37 - 0.03, top + 0.2, bz - 0.03], [bx + side * 0.37 + 0.03, top + 0.62, bz + 0.03], mat.wicker);
  add([bx - 0.4, top + 0.58, bz - 0.03], [bx + 0.4, top + 0.64, bz + 0.03], mat.wicker); // asa
  const basketFruit = [
    ['mango', mat.mango, [0.24, 0.2, 0.32], [-0.2, 0.1], 0.5],
    ['mango', mat.mango, [0.24, 0.2, 0.32], [0.18, -0.12], 2.1],
    ['papaya', mat.papaya, [0.22, 0.2, 0.4], [0.02, 0.12], 1.4],
    ['higo', mat.fig, [0.16, 0.18, 0.16], [-0.04, -0.14], 0.3],
    ['higo', mat.fig, [0.16, 0.18, 0.16], [0.26, 0.13], 1],
    ['tomate', mat.tomato, [0.17, 0.15, 0.17], [-0.26, -0.13], 0.8],
  ].map(([name, material, size, [dx, dz], turn]) => {
    const fruit = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    fruit.position.set(bx + dx, top + 0.2 + size[1] / 2, bz + dz);
    fruit.rotation.y = turn;
    extras.add(fruit);
    return [fruit, name];
  });

  // …y la cartita a su lado. Es interactiva, así que queda fuera del fundido de mallas.
  const blank = mat.paper;
  const letter = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.42), [blank, blank, mat.envelope, blank, blank, blank]);
  letter.position.set(-2.75, DINING.top + 0.011, 1.75);
  letter.rotation.y = 0.3;
  extras.add(letter);

  // --- Cocina ----------------------------------------------------------------------
  add([-8, 0, -6], [-7, 2, -5], mat.fridge);
  for (const [x0, x1] of [[-7, -5], [-4, -1.5]]) {
    add([x0, 0, -6], [x1, 0.9, -5.05], mat.cabinet);
    add([x0, 0.9, -6], [x1, 1, -4.95], mat.counter);
  }
  const stove = tiledBox([-5, 0, -6], [-4, 1, -5], [mat.metal, mat.metal, mat.stoveTop, mat.metal, mat.oven, mat.metal]);
  pieces.add(stove);
  add([-4, 2.1, -6], [-1.5, 3.1, -5.4], mat.cabinet); // armarios altos
  add([-6.5, 1, -5.8], [-5.5, 1.02, -5.2], mat.metal); // fregadero
  add([-6.04, 1, -5.95], [-5.96, 1.35, -5.87], mat.metal);
  add([-6.04, 1.29, -5.87], [-5.96, 1.35, -5.6], mat.metal);
  solid(-8, -6, -1.5, -4.95);

  // Barra que separa la cocina del comedor, con un frutero de mangos.
  add([-8, 0, -3], [-4, 0.9, -2], mat.cabinet);
  add([-8.0, 0.9, -3.06], [-3.94, 1, -1.94], mat.counter);
  solid(-8, -3.06, -3.94, -1.94);
  add([-6.3, 1, -2.8], [-5.7, 1.1, -2.2], mat.ceramic);
  for (const [dx, dz, turn] of [[-0.12, -0.08, 0.4], [0.13, 0.02, 1.9], [0, 0.14, 1.1]]) {
    const mango = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.3), mat.mango);
    mango.position.set(-6 + dx, 1.19, -2.5 + dz);
    mango.rotation.y = turn;
    pieces.add(mango);
  }
  lantern(-3.5, -4, 14);

  // --- Dormitorio ------------------------------------------------------------------
  add([4.5, 0, -6], [6.5, 0.35, -3], mat.wood); // cama: base, colchón, manta, almohadas, cabecero
  add([4.55, 0.35, -5.95], [6.45, 0.6, -3.05], mat.white);
  add([4.48, 0.4, -4.9], [6.52, 0.66, -3], mat.red);
  add([4.7, 0.6, -5.85], [5.4, 0.78, -5.2], mat.white);
  add([5.6, 0.6, -5.85], [6.3, 0.78, -5.2], mat.white);
  add([4.4, 0, -6], [6.6, 1.4, -5.9], mat.wood);
  solid(4.5, -6, 6.5, -3);

  for (const x of [3.9, 7.1]) {
    // Mesillas de noche, cada una con su portarretratos.
    add([x - 0.45, 0, -6], [x + 0.45, SIDE_TABLE, -5.1], mat.cabinet);
    solid(x - 0.45, -6, x + 0.45, -5.1);
    frameSlots.push({ x, y: SIDE_TABLE, z: -5.55, facing: 0 });
  }
  add([7, 0, -4.4], [8, 3, -2.4], mat.cabinet); // armario
  solid(7, -4.4, 8, -2.4);
  rugAt(5.5, -0.5, 3.4, 2.4);
  const bedroomLight = lantern(5.5, 0.5, 16);
  bookshelf(3, 3.15, 5.0, 3.2);

  // Pantalla de cine (el marco; la imagen la pone gallery/cinema.js) y proyector sobre el armario.
  const { x: sx, y: sy, z: sz, width: sw, height: sh } = SCREEN;
  add([sx - 0.06, sy - sh / 2 - 0.1, sz - sw / 2 - 0.1], [sx - 0.02, sy + sh / 2 + 0.1, sz + sw / 2 + 0.1], mat.metal);
  const projector = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.42), mat.metal);
  projector.position.set(7.35, 3.11, -2.85);
  extras.add(projector);
  const lens = new THREE.Vector3(7.06, 3.12, -2.85);
  add([lens.x - 0.06, lens.y - 0.07, lens.z - 0.07], [lens.x + 0.04, lens.y + 0.07, lens.z + 0.07], mat.lantern);

  // --- Mesitas de los portarretratos, en orden de recorrido --------------------------
  const before = frameSlots.splice(0); // las mesillas de noche van después de las del salón
  photoTable(-8, 0, -7.1, 4, Math.PI / 2); // pared izquierda del comedor
  photoTable(-7, 5.1, -3, 6, Math.PI); // bajo la ventana de la fachada
  photoTable(1.1, -4, 2, 0, -Math.PI / 2); // contra el tabique
  frameSlots.push(...before);
  photoTable(7.1, 2, 8, 5, -Math.PI / 2); // dormitorio, pared derecha
  photoTable(4, 5.1, 7, 6, Math.PI); // dormitorio, bajo la ventana (el rincón es del librero)

  return { extras, frameSlots, letter, basketFruit, cinema: { screen: SCREEN, lens, projector, roomLight: bedroomLight } };
}
