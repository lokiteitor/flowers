// Medidas compartidas del mundo, en bloques. La casita está centrada en el origen
// con la puerta mirando a +Z; el jugador aparece sobre el camino, de frente a ella.
export const WORLD_HALF = 48; // mitad del campo llano
export const HILLS_HALF = 64; // hasta dónde llegan las colinas del borde
export const PLAY_LIMIT = 45.5; // el jugador no pasa de aquí

export const HOUSE = { halfX: 6, halfZ: 5, wallHeight: 5, doorHalf: 1, doorHeight: 3 };
export const PATH = { halfWidth: 1, zStart: HOUSE.halfZ, zEnd: 34 };
export const SPAWN = { x: 0, z: 30 };

export const PLAYER = { eye: 1.62, radius: 0.3 };
