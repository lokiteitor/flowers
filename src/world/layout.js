// Medidas compartidas del mundo, en bloques. La casita está centrada en el origen
// con la puerta mirando a +Z; el jugador aparece sobre el camino, de frente a ella.
export const WORLD_HALF = 48; // mitad del campo llano
export const HILLS_HALF = 64; // hasta dónde llegan las colinas del borde
export const PLAY_LIMIT = 45.5; // el jugador no pasa de aquí

export const HOUSE = { halfX: 9, halfZ: 7, wallHeight: 4, doorHalf: 1, doorHeight: 3 };
// Altura de la cara inferior del tejado (escalonado, a dos aguas) sobre un punto del interior.
export const roofUnderside = (z) => HOUSE.wallHeight - 0.5 + (HOUSE.halfZ - Math.floor(Math.abs(z))) * 0.5;

export const PATH = { halfWidth: 1, zStart: HOUSE.halfZ, zEnd: 37 };
export const SPAWN = { x: 0, z: 33 };

// Jardín cercado delante de la casa, a ambos lados del camino.
export const GARDEN = { halfX: 10.5, zStart: HOUSE.halfZ, zEnd: 15.5, gateHalf: 1.5 };

export const PLAYER = { eye: 1.62, radius: 0.3 };
