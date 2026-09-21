import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTextures } from './textures.js';

// Flor pequeña al estilo Minecraft: dos planos cruzados con el dibujo de la flor, base en y = 0.
let crossGeometry;
function getCrossGeometry() {
  if (!crossGeometry) {
    const a = new THREE.PlaneGeometry(1, 1);
    const b = new THREE.PlaneGeometry(1, 1);
    b.rotateY(Math.PI / 2);
    crossGeometry = mergeGeometries([a, b]);
    crossGeometry.translate(0, 0.5, 0);
  }
  return crossGeometry;
}

const materials = new Map();
function flowerMaterial(kind) {
  if (!materials.has(kind)) {
    materials.set(kind, new THREE.MeshLambertMaterial({
      map: getTextures().flowers[kind], alphaTest: 0.5, side: THREE.DoubleSide,
    }));
  }
  return materials.get(kind);
}

// plants: [{ kind, x, y, z, size, turn, tiltX?, tiltZ? }] → un InstancedMesh por variedad.
export function plantFlowers(plants) {
  const group = new THREE.Group();
  const byKind = new Map();
  for (const plant of plants) {
    if (!byKind.has(plant.kind)) byKind.set(plant.kind, []);
    byKind.get(plant.kind).push(plant);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  for (const [kind, list] of byKind) {
    const mesh = new THREE.InstancedMesh(getCrossGeometry(), flowerMaterial(kind), list.length);
    list.forEach((p, i) => {
      euler.set(p.tiltX ?? 0, p.turn ?? 0, p.tiltZ ?? 0);
      mesh.setMatrixAt(i, m.compose(pos.set(p.x, p.y, p.z), q.setFromEuler(euler), scl.setScalar(p.size)));
    });
    group.add(mesh);
  }
  return group;
}
