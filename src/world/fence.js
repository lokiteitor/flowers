import { tiledBox, footprint } from './blocks.js';

// Devuelve una función que levanta tramos rectos de cerca (postes cada ~1,5 bloques y dos
// travesaños) añadiendo las piezas a `pieces` y su colisionador a `colliders`.
export function fenceBuilder(pieces, colliders, { posts, rails }) {
  return function fence(x0, z0, x1, z1) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const count = Math.max(1, Math.round(length / 1.5));
    for (let i = 0; i <= count; i++) {
      const x = x0 + ((x1 - x0) * i) / count;
      const z = z0 + ((z1 - z0) * i) / count;
      pieces.add(tiledBox([x - 0.12, 0, z - 0.12], [x + 0.12, 1.05, z + 0.12], posts));
    }
    const min = [Math.min(x0, x1) - 0.06, 0, Math.min(z0, z1) - 0.06];
    const max = [Math.max(x0, x1) + 0.06, 0, Math.max(z0, z1) + 0.06];
    for (const y of [0.4, 0.8]) pieces.add(tiledBox([min[0], y, min[2]], [max[0], y + 0.13, max[2]], rails));
    colliders.push(footprint(min, max));
  };
}
