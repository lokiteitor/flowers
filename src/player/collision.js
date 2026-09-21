import { PLAY_LIMIT } from '../world/layout.js';

// Empuja un círculo (el jugador, visto desde arriba) fuera de cada caja que pise.
// Al resolver caja por caja el jugador resbala a lo largo de los muros.
export function resolveCollisions(position, radius, colliders) {
  for (const box of colliders) {
    const nearX = Math.max(box.minX, Math.min(position.x, box.maxX));
    const nearZ = Math.max(box.minZ, Math.min(position.z, box.maxZ));
    const dx = position.x - nearX;
    const dz = position.z - nearZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;

    if (distSq > 1e-9) {
      const dist = Math.sqrt(distSq);
      position.x = nearX + (dx / dist) * radius;
      position.z = nearZ + (dz / dist) * radius;
    } else {
      // Centro dentro de la caja: salir por la cara más cercana.
      const exits = [
        [position.x - box.minX, -1, 0],
        [box.maxX - position.x, 1, 0],
        [position.z - box.minZ, 0, -1],
        [box.maxZ - position.z, 0, 1],
      ];
      const [depth, sx, sz] = exits.reduce((a, b) => (b[0] < a[0] ? b : a));
      position.x += sx * (depth + radius);
      position.z += sz * (depth + radius);
    }
  }
  position.x = Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, position.x));
  position.z = Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, position.z));
}
