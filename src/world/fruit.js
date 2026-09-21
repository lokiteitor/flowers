import * as THREE from 'three';

// Frutos instanciados. items: [{ x, y, z, rx?, ry?, rz?, scale?, color? }] (color = tinte por instancia).
export function instancedFruit(geometry, material, items) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const tint = new THREE.Color();
  items.forEach((item, i) => {
    euler.set(item.rx ?? 0, item.ry ?? 0, item.rz ?? 0);
    m.compose(pos.set(item.x, item.y, item.z), q.setFromEuler(euler), scl.setScalar(item.scale ?? 1));
    mesh.setMatrixAt(i, m);
    if (item.color !== undefined) mesh.setColorAt(i, tint.set(item.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
