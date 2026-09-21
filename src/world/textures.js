import * as THREE from 'three';
import { mulberry32 } from '../util/random.js';

// Texturas pixel-art generadas en canvas: nada de assets externos.

function makeTexture(size, seed, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed);
  const put = (x, y, rgb, alpha = 1) => {
    ctx.fillStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  };
  draw(put, rng, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const shade = (rgb, k) => [rgb[0] * k, rgb[1] * k, rgb[2] * k];
const jitter = (rgb, rng, amp) => shade(rgb, 1 + (rng() - 0.5) * amp);

function fillNoise(put, rng, size, base, amp) {
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, jitter(base, rng, amp));
}

function planks(base) {
  return (put, rng, size) => {
    for (let y = 0; y < size; y++) {
      const board = y >> 2;
      const seam = (board * 7 + 3) % size;
      for (let x = 0; x < size; x++) {
        let c = jitter(base, rng, 0.12);
        if (x === seam) c = shade(c, 0.72);
        if (y % 4 === 3) c = shade(c, 0.66);
        else if (y % 4 === 0) c = shade(c, 1.06);
        put(x, y, c);
      }
    }
  };
}

function cobble(put, rng, size) {
  const stones = [];
  for (let i = 0; i < 9; i++) stones.push([rng() * size, rng() * size, 0.78 + rng() * 0.4]);
  const wrapDist = (a, b) => {
    const d = Math.abs(a - b);
    return Math.min(d, size - d);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let best = 99, second = 99, tone = 1;
      for (const [sx, sy, st] of stones) {
        const d = Math.hypot(wrapDist(x, sx), wrapDist(y, sy));
        if (d < best) { second = best; best = d; tone = st; }
        else if (d < second) second = d;
      }
      const mortar = second - best < 0.9;
      put(x, y, jitter(shade([132, 132, 136], mortar ? 0.55 : tone), rng, 0.1));
    }
  }
}

function log(put, rng, size) {
  const columns = [];
  for (let x = 0; x < size; x++) columns.push(0.8 + rng() * 0.4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) put(x, y, jitter(shade([104, 78, 47], columns[x]), rng, 0.12));
}

function grassSide(put, rng, size) {
  for (let x = 0; x < size; x++) {
    const depth = 2 + Math.floor(rng() * 3);
    for (let y = 0; y < size; y++) {
      put(x, y, y < depth ? jitter([96, 160, 62], rng, 0.2) : jitter([134, 96, 67], rng, 0.18));
    }
  }
}

function glass(put, rng, size) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const border = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const streak = (x + y === 6 || x + y === 7 || x + y === 21) && x > 1 && y > 1;
      if (border) put(x, y, [214, 236, 244], 0.95);
      else if (streak) put(x, y, [255, 255, 255], 0.6);
      else put(x, y, [190, 225, 240], 0.16);
    }
  }
}

function sunflowerHead(front) {
  return (put, rng, size) => {
    const c = (size - 1) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - c, dy = y - c;
        const d = Math.hypot(dx, dy);
        const petalReach = 5.6 + 2.2 * Math.abs(Math.cos(Math.atan2(dy, dx) * 4));
        if (d < 3.3) {
          if (front) put(x, y, jitter(d < 1.8 ? [74, 46, 22] : [104, 66, 28], rng, 0.25));
          else put(x, y, jitter([86, 140, 52], rng, 0.15));
        } else if (d < petalReach) {
          const base = d < 4.6 ? [244, 164, 28] : [252, 210, 40];
          put(x, y, jitter(front ? base : shade(base, 0.8), rng, 0.1));
        }
      }
    }
  };
}

function emptyFrame(put, rng, size) {
  const ink = [122, 92, 58];
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = x === 2 || y === 2 || x === size - 3 || y === size - 3;
      const inside = x >= 2 && y >= 2 && x <= size - 3 && y <= size - 3;
      const dashed = edge && inside && ((x + y) >> 1) % 2 === 0;
      const plus =
        (Math.abs(x - c + 0.5) < 1 && Math.abs(y - c + 0.5) < 5) ||
        (Math.abs(y - c + 0.5) < 1 && Math.abs(x - c + 0.5) < 5);
      put(x, y, dashed || plus ? ink : jitter([233, 220, 190], rng, 0.06));
    }
  }
}

function rug(put, rng, size) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ring = Math.min(x, y, size - 1 - x, size - 1 - y);
      const base = ring === 0 ? [238, 222, 186] : ring === 2 ? [246, 196, 60] : [168, 48, 52];
      put(x, y, jitter(base, rng, 0.1));
    }
  }
}

function celestial(base, rim, spots) {
  return (put, rng, size) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const border = x === 0 || y === 0 || x === size - 1 || y === size - 1;
        put(x, y, border ? rim : spots && rng() < 0.12 ? shade(base, 0.82) : base);
      }
    }
  };
}


function water(put, rng, size) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ripple = (x + y * 5) % 16 === 0 || ((x * 3 + y) % 23 === 0 && rng() < 0.5);
      put(x, y, jitter(ripple ? [96, 150, 214] : [24, 70, 150], rng, 0.1));
    }
  }
}

function lilypad(put, rng, size) {
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c, dy = y - c;
      const notch = dx > 0 && Math.abs(dy) < dx * 0.35; // la muesca típica de la hoja
      if (Math.hypot(dx, dy) < 6.6 && !notch) put(x, y, jitter([38, 122, 46], rng, 0.2));
    }
  }
}

function checker(a, b) {
  return (put, rng, size) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const edge = x % 8 === 0 || y % 8 === 0;
        const base = ((x >> 3) + (y >> 3)) % 2 ? a : b;
        put(x, y, jitter(edge ? shade(base, 0.85) : base, rng, 0.05));
      }
  };
}

// Frente de electrodoméstico o de armario: panel liso con marco y un tirador.
function appliance(base, handle) {
  return (put, rng, size) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
        const grip = x >= 12 && x <= 13 && y >= 4 && y <= 11;
        put(x, y, grip ? handle : jitter(edge ? shade(base, 0.8) : base, rng, 0.04));
      }
  };
}

function stoveTop(put, rng, size) {
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x % 8) - 3.5, (y % 8) - 3.5);
      put(x, y, jitter(d > 1.6 && d < 3.1 ? [24, 24, 28] : [78, 80, 86], rng, 0.08));
    }
}

function ovenFront(put, rng, size) {
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const glass = x > 2 && x < 13 && y > 5 && y < 13;
      const knob = y === 2 && x % 4 === 2;
      put(x, y, knob ? [230, 230, 230] : jitter(glass ? [30, 26, 24] : [78, 80, 86], rng, 0.08));
    }
}

function envelope(put, rng, size) {
  const rows = [
    'oooooooooooooooo',
    'owppppppppppppwo',
    'oppwppppppppwppo',
    'oppppwppppwppppo',
    'oppppprrprrppppo',
    'oppppprrrrrppppo',
    'opppppprrrpppppo',
    'oppppppprppppppo',
    'oppppppppppppppo',
    'oooooooooooooooo',
  ];
  const palette = { o: [150, 120, 84], p: [250, 240, 214], w: [206, 186, 150], r: [214, 48, 66] };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const row = rows[Math.min(rows.length - 1, Math.floor((y / size) * rows.length))];
      put(x, y, jitter(palette[row[x]] ?? palette.p, rng, 0.03));
    }
}

// Flores de jardín como las de Minecraft: un dibujo 16×16 con tallo, hojas y cabeza,
// que luego se monta sobre dos planos cruzados.
function flowerSprite(shape, petal, heart) {
  return (put, rng) => {
    const stem = [62, 128, 46];
    const topOf = { daisy: 6, tulip: 6, ball: 7, spike: 8 }[shape];
    for (let y = topOf; y < 16; y++) put(7, y, jitter(stem, rng, 0.15));
    for (const [x, y] of [[6, 12], [5, 11], [8, 13], [9, 12], [10, 11]]) put(x, y, jitter(stem, rng, 0.2));

    if (shape === 'daisy') {
      for (let y = 0; y < 8; y++)
        for (let x = 3; x < 12; x++) {
          const d = Math.hypot(x - 7, y - 3.5);
          if (d < 1.3) put(x, y, jitter(heart, rng, 0.1));
          else if (d < 2.8 || (d < 3.7 && (x + y) % 2 === 0)) put(x, y, jitter(petal, rng, 0.12));
        }
    } else if (shape === 'tulip') {
      for (let y = 1; y < 7; y++)
        for (let x = 5; x < 10; x++) {
          if (y === 1 && x % 2 === 0) continue; // puntas de los pétalos
          if (y === 6 && (x === 5 || x === 9)) continue;
          put(x, y, jitter(x === 7 ? shade(petal, 0.85) : petal, rng, 0.1));
        }
    } else if (shape === 'ball') {
      for (let y = 0; y < 8; y++)
        for (let x = 3; x < 12; x++)
          if (Math.hypot(x - 7, y - 3.5) < 3.4) put(x, y, jitter(rng() < 0.3 ? heart : petal, rng, 0.15));
    } else {
      for (let y = 0; y < 9; y++) {
        const half = y < 2 ? 0 : 1;
        for (let x = 7 - half; x <= 7 + half; x++) put(x, y, jitter(rng() < 0.3 ? heart : petal, rng, 0.15));
      }
    }
  };
}

export const FLOWER_KINDS = {
  poppy: ['daisy', [214, 40, 40], [40, 20, 20]],
  daisy: ['daisy', [245, 245, 245], [250, 204, 50]],
  cornflower: ['daisy', [70, 110, 230], [40, 60, 160]],
  dandelion: ['daisy', [252, 214, 40], [244, 164, 28]],
  pinkTulip: ['tulip', [240, 130, 180], null],
  orangeTulip: ['tulip', [244, 140, 40], null],
  yellowTulip: ['tulip', [250, 214, 50], null],
  allium: ['ball', [178, 102, 226], [214, 160, 245]],
  lavender: ['spike', [140, 110, 220], [186, 160, 245]],
};

// Matas del huerto, con el mismo formato que las flores (dibujo 16×16 sobre planos cruzados).
function bushSprite(leaf, top, blossom) {
  return (put, rng) => {
    for (let y = top; y < 16; y++) {
      const t = (y - top) / (15 - top);
      const half = 1.5 + 5.5 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62);
      for (let x = 0; x < 16; x++) {
        if (Math.abs(x - 7.5) > half || rng() < 0.12) continue;
        put(x, y, blossom && rng() < 0.05 ? blossom : jitter(leaf, rng, 0.4));
      }
    }
  };
}

function chardSprite(put, rng) {
  for (const [sx, topY, stalk] of [[3, 6, [226, 60, 80]], [7, 3, [245, 240, 230]], [11, 5, [240, 190, 60]]]) {
    for (let y = topY + 3; y < 16; y++) put(sx + (y > 12 ? Math.sign(7 - sx) : 0), y, stalk);
    for (let y = topY; y < topY + 7; y++)
      for (let x = sx - 3; x <= sx + 3; x++) {
        if (Math.hypot((x - sx) / 3.2, (y - topY - 3) / 3.8) > 1) continue;
        put(x, y, x === sx ? shade(stalk, 0.9) : jitter([36, 110, 50], rng, 0.35));
      }
  }
}

function papayaLeaf(put, rng, size) {
  // Hoja palmeada: lóbulos que irradian desde el centro, con el pecíolo hacia la base (abajo).
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x - 7.5, dy = y - 6;
      const reach = 6.8 * (0.45 + 0.55 * Math.abs(Math.cos(Math.atan2(dy, dx) * 3.5)));
      if (Math.hypot(dx, dy) < reach) put(x, y, jitter([52, 132, 48], rng, 0.3));
      else if (Math.abs(dx) < 1 && y > 6) put(x, y, [120, 150, 70]);
    }
}

function melonSkin(put, rng, size) {
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) put(x, y, jitter(x % 4 === 0 ? [54, 110, 40] : [120, 176, 60], rng, 0.12));
}

function wicker(put, rng, size) {
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const over = ((x >> 1) + (y >> 1)) % 2 === 0;
      put(x, y, jitter(over ? [196, 150, 84] : [150, 106, 54], rng, 0.12));
    }
}

const PLANT_SPRITES = {
  tomatoBush: bushSprite([50, 120, 44], 1, [250, 220, 60]),
  chileBush: bushSprite([44, 110, 50], 5, [245, 245, 245]),
  squashBush: bushSprite([60, 134, 50], 7, [250, 200, 40]),
  melonVine: bushSprite([70, 140, 56], 10, null),
  chard: chardSprite,
};

let cache;

export function getTextures() {
  if (cache) return cache;
  cache = {
    grassTop: makeTexture(16, 11, (put, rng, s) => fillNoise(put, rng, s, [96, 160, 62], 0.22)),
    grassSide: makeTexture(16, 12, grassSide),
    dirt: makeTexture(16, 13, (put, rng, s) => fillNoise(put, rng, s, [134, 96, 67], 0.2)),
    path: makeTexture(16, 14, (put, rng, s) => fillNoise(put, rng, s, [176, 146, 92], 0.16)),
    planks: makeTexture(16, 15, planks([188, 152, 98])),
    darkPlanks: makeTexture(16, 16, planks([104, 62, 40])),
    cobble: makeTexture(16, 17, cobble),
    log: makeTexture(16, 18, log),
    // Hoja de mango: verde oscuro y denso, con algún brote rojizo.
    leaves: makeTexture(16, 19, (put, rng, s) => {
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) put(x, y, rng() < 0.05 ? [150, 84, 50] : jitter([40, 98, 40], rng, 0.5));
    }),
    mango: makeTexture(8, 31, (put, rng, s) => {
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          const blush = Math.max(0, 1 - (x + y) / 7); // rubor rojo en una esquina de arriba
          put(x, y, jitter([250 - blush * 20, 184 - blush * 110, 40 + blush * 10], rng, 0.1));
        }
    }),
    glass: makeTexture(16, 20, glass),
    stem: makeTexture(8, 21, (put, rng, s) => fillNoise(put, rng, s, [78, 138, 48], 0.2)),
    flowerFront: makeTexture(16, 22, sunflowerHead(true)),
    flowerBack: makeTexture(16, 23, sunflowerHead(false)),
    frameWood: makeTexture(16, 25, planks([78, 50, 30])),
    emptyFrame: makeTexture(32, 26, emptyFrame),
    rug: makeTexture(16, 27, rug),
    lantern: makeTexture(8, 28, (put, rng, s) => fillNoise(put, rng, s, [255, 214, 120], 0.18)),
    sand: makeTexture(16, 32, (put, rng, s) => fillNoise(put, rng, s, [168, 156, 116], 0.14)),
    water: makeTexture(16, 33, water),
    lilypad: makeTexture(16, 34, lilypad),
    mulch: makeTexture(16, 35, (put, rng, s) => fillNoise(put, rng, s, [84, 58, 40], 0.3)),
    tile: makeTexture(16, 36, checker([236, 228, 210], [196, 112, 84])),
    counter: makeTexture(16, 37, (put, rng, s) => fillNoise(put, rng, s, [168, 168, 172], 0.08)),
    fridge: makeTexture(16, 38, appliance([232, 236, 240], [120, 124, 130])),
    cabinet: makeTexture(16, 39, appliance([150, 104, 62], [60, 40, 24])),
    stoveTop: makeTexture(16, 40, stoveTop),
    ovenFront: makeTexture(16, 41, ovenFront),
    metal: makeTexture(8, 42, (put, rng, s) => fillNoise(put, rng, s, [78, 80, 86], 0.08)),
    woolRed: makeTexture(16, 43, (put, rng, s) => fillNoise(put, rng, s, [176, 46, 52], 0.14)),
    woolWhite: makeTexture(16, 44, (put, rng, s) => fillNoise(put, rng, s, [238, 236, 230], 0.08)),
    ceramic: makeTexture(8, 45, (put, rng, s) => {
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) put(x, y, jitter(y === 2 || y === 5 ? [70, 120, 200] : [240, 242, 246], rng, 0.05));
    }),
    envelope: makeTexture(16, 46, envelope),
    // Todo lo que se planta con planos cruzados: flores de jardín y matas del huerto.
    flowers: Object.fromEntries([
      ...Object.entries(FLOWER_KINDS).map(([name, [shape, petal, heart]], i) => [
        name,
        makeTexture(16, 60 + i, flowerSprite(shape, petal, heart ?? petal)),
      ]),
      ...Object.entries(PLANT_SPRITES).map(([name, draw], i) => [name, makeTexture(16, 80 + i, draw)]),
    ]),
    figLeaves: makeTexture(16, 47, (put, rng, s) => fillNoise(put, rng, s, [74, 142, 52], 0.4)),
    papayaTrunk: makeTexture(16, 48, (put, rng, s) => {
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) put(x, y, jitter(y % 5 === 0 && x % 3 ? [120, 108, 86] : [168, 156, 128], rng, 0.1));
    }),
    papayaLeaf: makeTexture(16, 49, papayaLeaf),
    fig: makeTexture(8, 50, (put, rng, s) => fillNoise(put, rng, s, [104, 52, 120], 0.2)),
    papaya: makeTexture(8, 51, (put, rng, s) => {
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) put(x, y, jitter(y < 3 ? [150, 170, 60] : [244, 156, 40], rng, 0.1));
    }),
    tomato: makeTexture(8, 52, (put, rng, s) => fillNoise(put, rng, s, [222, 44, 36], 0.12)),
    chile: makeTexture(8, 53, (put, rng, s) => fillNoise(put, rng, s, [235, 235, 235], 0.1)), // se tiñe por instancia
    melon: makeTexture(16, 54, melonSkin),
    zucchini: makeTexture(8, 55, (put, rng, s) => {
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) put(x, y, jitter(rng() < 0.15 ? [130, 170, 80] : [44, 96, 40], rng, 0.12));
    }),
    wicker: makeTexture(16, 56, wicker),
    sun: makeTexture(8, 29, celestial([255, 246, 190], [255, 224, 120], false)),
    moon: makeTexture(8, 30, celestial([226, 232, 246], [196, 204, 226], true)),
  };
  return cache;
}
