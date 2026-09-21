import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../util/random.js';
import { getTextures } from './textures.js';
import { HOUSE, PATH } from './layout.js';

const FIELD_HALF = 47;

// Inyecta en un material Lambert el giro de la cabeza hacia el sol (uYaw) y el vaivén
// del viento. El vaivén depende solo de la posición XZ de la instancia, así tallo,
// hojas y cabeza de una misma flor se mueven juntos.
function windMaterial(params, shared, { followSun = false, swayBase = 0, swayByHeight = 0 }) {
  const material = new THREE.MeshLambertMaterial(params);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uYaw = followSun ? shared.uYaw : { value: 0 };
    shader.uniforms.uSway = { value: new THREE.Vector2(swayBase, swayByHeight) };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uYaw;
        uniform vec2 uSway;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `float yawC = cos(uYaw);
        float yawS = sin(uYaw);
        vec3 objectNormal = vec3(normal.x * yawC + normal.z * yawS, normal.y, -normal.x * yawS + normal.z * yawC);`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position.x * yawC + position.z * yawS, position.y, -position.x * yawS + position.z * yawC);`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
        vec3 root = instanceMatrix[3].xyz;
        float gust = sin(uTime * 1.3 + root.x * 0.35 + root.z * 0.27) * 0.07
                   + sin(uTime * 2.3 + root.z * 0.6) * 0.03;
        float bend = uSway.x + uSway.y * position.y * position.y;
        mvPosition.x += gust * bend;
        mvPosition.z += gust * bend * 0.5;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  return material;
}

function headGeometry() {
  const front = new THREE.PlaneGeometry(0.9, 0.9);
  const back = new THREE.PlaneGeometry(0.9, 0.9);
  back.rotateY(Math.PI);
  back.translate(0, 0, -0.01);
  const head = mergeGeometries([front, back], true); // un grupo por cara → un material por cara
  head.translate(0, 0.05, 0.09); // por delante del tallo
  head.rotateX(-0.3); // mirando un poco hacia arriba
  return head;
}

function leafGeometry() {
  const leaf = new THREE.BoxGeometry(0.5, 0.03, 0.24);
  leaf.translate(0.3, 0, 0);
  leaf.rotateZ(0.35);
  return leaf;
}

function isClear(x, z, treeSpots) {
  if (Math.abs(x) < HOUSE.halfX + 2.5 && Math.abs(z) < HOUSE.halfZ + 2.5) return false;
  if (Math.abs(x) < PATH.halfWidth + 0.7 && z > 0 && z < PATH.zEnd + 1.5) return false;
  return !treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 1.2);
}

export function createSunflowers({ spacing, treeSpots }) {
  const tex = getTextures();
  const rng = mulberry32(99);
  const shared = { uTime: { value: 0 }, uYaw: { value: 0 } };

  const flowers = [];
  for (let gx = -FIELD_HALF; gx < FIELD_HALF; gx += spacing) {
    for (let gz = -FIELD_HALF; gz < FIELD_HALF; gz += spacing) {
      const x = gx + rng() * spacing;
      const z = gz + rng() * spacing;
      if (!isClear(x, z, treeSpots)) continue;
      flowers.push({ x, z, height: 1.0 + rng() * 0.55, scale: 0.8 + rng() * 0.35, turn: rng() * Math.PI * 2 });
    }
  }

  const stemGeo = new THREE.BoxGeometry(0.09, 1, 0.09);
  stemGeo.translate(0, 0.5, 0);
  const stems = new THREE.InstancedMesh(
    stemGeo,
    windMaterial({ map: tex.stem }, shared, { swayByHeight: 1 }),
    flowers.length,
  );
  const leaves = new THREE.InstancedMesh(
    leafGeometry(),
    windMaterial({ map: tex.stem }, shared, { swayBase: 0.28 }),
    flowers.length * 2,
  );
  const headParams = { alphaTest: 0.4, side: THREE.FrontSide };
  const heads = new THREE.InstancedMesh(
    headGeometry(),
    [
      windMaterial({ map: tex.flowerFront, ...headParams }, shared, { followSun: true, swayBase: 1 }),
      windMaterial({ map: tex.flowerBack, ...headParams }, shared, { followSun: true, swayBase: 1 }),
    ],
    flowers.length,
  );

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const tint = new THREE.Color();
  const identity = new THREE.Quaternion();

  flowers.forEach((f, i) => {
    stems.setMatrixAt(i, m.compose(pos.set(f.x, 0, f.z), identity, scl.set(f.scale, f.height, f.scale)));

    for (let side = 0; side < 2; side++) {
      q.setFromAxisAngle(up, f.turn + side * Math.PI);
      pos.set(f.x, f.height * (0.45 + side * 0.15), f.z);
      leaves.setMatrixAt(i * 2 + side, m.compose(pos, q, scl.setScalar(f.scale)));
    }

    // Cada cabeza se desvía un poco del sol para que el campo no parezca clonado.
    q.setFromAxisAngle(up, (rng() - 0.5) * 0.5);
    heads.setMatrixAt(i, m.compose(pos.set(f.x, f.height, f.z), q, scl.setScalar(f.scale)));
    heads.setColorAt(i, tint.setHSL(0, 0, 0.88 + rng() * 0.12));
  });

  const group = new THREE.Group();
  for (const mesh of [stems, leaves, heads]) {
    mesh.instanceMatrix.needsUpdate = true;
    // El viento y el giro mueven vértices fuera de la caja original: mejor no recortar.
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  return {
    group,
    count: flowers.length,
    update(time, sunYaw) {
      shared.uTime.value = time;
      shared.uYaw.value = sunYaw;
    },
  };
}
