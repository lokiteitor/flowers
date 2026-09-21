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

function fromRows(rows, palette) {
  return (put) => {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (palette[ch]) put(x, y, palette[ch]);
      });
    });
  };
}

const HEART = [
  '................',
  '................',
  '..oooo....oooo..',
  '.orrrro..orrrro.',
  'orrwwrroorrrrrro',
  'orrwrrrrrrrrrrro',
  'orrrrrrrrrrrrrro',
  'orrrrrrrrrrrrrro',
  '.orrrrrrrrrrrro.',
  '..orrrrrrrrrro..',
  '...orrrrrrrro...',
  '....orrrrrro....',
  '.....orrrro.....',
  '......orro......',
  '.......oo.......',
  '................',
];

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
    heart: makeTexture(16, 24, fromRows(HEART, { o: [92, 16, 28], r: [226, 48, 66], w: [255, 190, 200] })),
    frameWood: makeTexture(16, 25, planks([78, 50, 30])),
    emptyFrame: makeTexture(32, 26, emptyFrame),
    rug: makeTexture(16, 27, rug),
    lantern: makeTexture(8, 28, (put, rng, s) => fillNoise(put, rng, s, [255, 214, 120], 0.18)),
    sun: makeTexture(8, 29, celestial([255, 246, 190], [255, 224, 120], false)),
    moon: makeTexture(8, 30, celestial([226, 232, 246], [196, 204, 226], true)),
  };
  return cache;
}
