import * as THREE from 'three';

// Caja entre dos esquinas con UVs escaladas para que la textura se repita una vez por bloque.
export function tiledBox(min, max, material) {
  const w = max[0] - min[0];
  const h = max[1] - min[1];
  const d = max[2] - min[2];
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv;
  // Orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z (4 vértices cada una).
  const faceSize = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = faceSize[i >> 2];
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(min[0] + w / 2, min[1] + h / 2, min[2] + d / 2);
  return mesh;
}

// Colisionador en planta (XZ) a partir de las mismas esquinas.
export const footprint = (min, max) => ({ minX: min[0], maxX: max[0], minZ: min[2], maxZ: max[2] });
