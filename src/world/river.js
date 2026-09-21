import { HILLS_HALF } from './layout.js';

// El río cruza el mundo de oeste a este entre el punto de partida y la casita, serpenteando.
// En los extremos tuerce hacia +Z para perderse tras las colinas en vez de acabar a la vista.
export const RIVER_HALF = 2.6;
export const RIVER_BED = -1; // altura del lecho
export const WATER_LEVEL = -0.2;
export const BRIDGE = { halfWidth: 1.5, top: 0.08 };

const bendFrom = 44;

export function riverZ(x) {
  const over = Math.max(0, Math.abs(x) - bendFrom);
  return 23 + 3 * Math.sin(x * 0.09) + 0.1 * over * over;
}

function riverSlope(x) {
  const over = Math.max(0, Math.abs(x) - bendFrom);
  return 0.27 * Math.cos(x * 0.09) + 0.2 * over * Math.sign(x);
}

// Distancia (aproximada) al eje del río, medida en perpendicular a la corriente.
export function riverDistance(x, z) {
  return Math.abs(z - riverZ(x)) / Math.hypot(1, riverSlope(x));
}

// Dirección de la corriente en x, como vector unitario (dx, dz).
export function riverFlow(x) {
  const slope = riverSlope(x);
  const len = Math.hypot(1, slope);
  return [1 / len, slope / len];
}

export const isRiverCell = (ix, iz) => riverDistance(ix + 0.5, iz + 0.5) < RIVER_HALF;

// Tramo de Z que cubre el puente: las celdas de río bajo el camino, más un bloque por orilla.
export const bridgeSpan = (() => {
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let ix = -2; ix < 2; ix++) {
    for (let iz = 0; iz < HILLS_HALF; iz++) {
      if (!isRiverCell(ix, iz)) continue;
      z0 = Math.min(z0, iz);
      z1 = Math.max(z1, iz + 1);
    }
  }
  return { z0: z0 - 1, z1: z1 + 1 };
})();

export function onBridge(x, z) {
  return Math.abs(x) < BRIDGE.halfWidth && z > bridgeSpan.z0 && z < bridgeSpan.z1;
}

// Altura del suelo que pisa el jugador.
export function groundHeightAt(x, z) {
  if (onBridge(x, z)) return BRIDGE.top;
  return isRiverCell(Math.floor(x), Math.floor(z)) ? RIVER_BED : 0;
}
