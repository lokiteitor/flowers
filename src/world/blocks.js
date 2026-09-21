import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

// Funde en una sola malla todas las cajas que comparten material: la casa y sus muebles
// son cientos de piezas, y así cuestan un puñado de llamadas de dibujo.
// Lo que no es una malla simple (luces, instanciados, multimaterial) se conserva tal cual.
export function mergeStatic(source) {
  source.updateMatrixWorld(true);
  const merged = new THREE.Group();
  const byMaterial = new Map();
  const keep = [];
  source.traverse((node) => {
    if (node === source || node.isGroup) return;
    const simple = node.isMesh && !node.isInstancedMesh && !Array.isArray(node.material) && !node.userData.keep;
    if (!simple) {
      keep.push(node);
      return;
    }
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    if (!byMaterial.has(node.material)) byMaterial.set(node.material, []);
    byMaterial.get(node.material).push(geometry);
  });
  for (const node of keep) {
    node.applyMatrix4(node.parent.matrixWorld);
    merged.add(node);
  }
  for (const [material, geometries] of byMaterial) {
    merged.add(new THREE.Mesh(mergeGeometries(geometries), material));
    geometries.forEach((g) => g.dispose());
  }
  return merged;
}
