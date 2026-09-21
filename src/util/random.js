// RNG con semilla: el mundo sale idéntico en cada visita.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

// Ruido de valor 2D en [0, 1]. Con `period` el patrón se repite (útil para las nubes).
export function valueNoise(x, z, seed = 1, period = 0) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fz = smooth(z - z0);
  const wrap = (v) => (period ? ((v % period) + period) % period : v);
  const a = hash2(wrap(x0), wrap(z0), seed);
  const b = hash2(wrap(x0 + 1), wrap(z0), seed);
  const c = hash2(wrap(x0), wrap(z0 + 1), seed);
  const d = hash2(wrap(x0 + 1), wrap(z0 + 1), seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
