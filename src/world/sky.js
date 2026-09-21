import * as THREE from 'three';
import { mulberry32, valueNoise } from '../util/random.js';
import { getTextures } from './textures.js';

const DAY_SHARE = 0.75; // fracción del ciclo con el sol sobre el horizonte
const SUN_TILT = THREE.MathUtils.degToRad(35); // el arco del sol se inclina hacia +Z
const FAR = 260;
const WHITE = new THREE.Color(0xffffff);

// Paletas indexadas por la altura del sol (-1 … 1).
const ZENITH = [[-0.3, 0x060a22], [-0.05, 0x272c66], [0.1, 0x4a69b4], [0.35, 0x5b8ff0], [1, 0x5a92ff]];
const HORIZON = [[-0.3, 0x0c1230], [-0.08, 0x8a4a58], [0.02, 0xff9256], [0.2, 0xffcf96], [0.45, 0xbcd7ff], [1, 0xbcd7ff]];
const SUNLIGHT = [[0, 0xff8a3c], [0.2, 0xffc98a], [0.5, 0xfff4e0], [1, 0xffffff]];
const CLOUDS = [[-0.3, 0x2a3050], [-0.05, 0xc07a7a], [0.08, 0xffc59a], [0.35, 0xffffff], [1, 0xffffff]];

function makeRamp(stops) {
  const colors = stops.map(([, hex]) => new THREE.Color(hex));
  return (e, target) => {
    if (e <= stops[0][0]) return target.copy(colors[0]);
    for (let i = 1; i < stops.length; i++) {
      if (e <= stops[i][0]) {
        const t = (e - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        return target.copy(colors[i - 1]).lerp(colors[i], t);
      }
    }
    return target.copy(colors[colors.length - 1]);
  };
}

function createDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color(0xff7a30) },
      uGlowAmount: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform float uGlowAmount;
      uniform vec3 uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        float up = clamp(dir.y, 0.0, 1.0);
        vec3 color = mix(uHorizon, uTop, 1.0 - pow(1.0 - up, 2.5));
        float toSun = max(dot(dir, uSunDir), 0.0);
        color += uGlow * pow(toSun, 6.0) * uGlowAmount * (1.0 - up * 0.6);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), material);
  dome.renderOrder = -3;
  dome.frustumCulled = false;
  return dome;
}

function createStars() {
  const rng = mulberry32(5);
  const points = [];
  while (points.length < 700 * 3) {
    const v = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
    if (v.lengthSq() > 1 || v.lengthSq() < 0.01) continue;
    v.normalize().multiplyScalar(FAR + 20);
    points.push(v.x, v.y, v.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(geometry, material);
  stars.renderOrder = -2;
  stars.frustumCulled = false;
  return stars;
}

function createDisc(map, size) {
  const material = new THREE.MeshBasicMaterial({ map, fog: false, depthWrite: false, transparent: true });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  disc.renderOrder = -1;
  return disc;
}

// Nubes planas en bloques sobre un patrón periódico: al derivar, el dibujo se recoloca
// celda a celda y el salto queda oculto por la niebla.
function createClouds() {
  const CELLS = 72;
  const CELL = 5;
  const HEIGHT = 46;
  const pattern = [];
  for (let i = 0; i < CELLS; i++) {
    pattern.push([]);
    for (let j = 0; j < CELLS; j++) pattern[i].push(valueNoise(i * 0.16, j * 0.22, 31, CELLS) > 0.6);
  }
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, depthWrite: false });
  // A lo lejos las nubes se desvanecen en vez de teñirse de niebla, que dibujaría una franja en el cielo.
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      'gl_FragColor.a *= 1.0 - smoothstep(fogNear * 1.6, fogFar * 1.25, vFogDepth);',
    );
  };
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 2, CELL), material, CELLS * CELLS);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  let shown = null;

  function place(shift) {
    let n = 0;
    for (let i = 0; i < CELLS; i++) {
      for (let j = 0; j < CELLS; j++) {
        if (!pattern[(((i - shift) % CELLS) + CELLS) % CELLS][j]) continue;
        mesh.setMatrixAt(n++, m.makeTranslation((i - CELLS / 2) * CELL, HEIGHT, (j - CELLS / 2) * CELL));
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    mesh,
    material,
    update(time) {
      const drift = time * 0.7;
      const shift = Math.floor(drift / CELL);
      if (shift !== shown) place((shown = shift));
      mesh.position.x = drift - shift * CELL;
    },
  };
}

export function createSky(scene, { cycleSeconds, startPhase }) {
  const tex = getTextures();
  const group = new THREE.Group();
  const dome = createDome();
  const stars = createStars();
  const sun = createDisc(tex.sun, 34);
  const moon = createDisc(tex.moon, 24);
  const clouds = createClouds();
  group.add(dome, stars, sun, moon);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a6b3c, 1);
  scene.add(group, clouds.mesh, sunLight, sunLight.target, hemi);
  scene.fog = new THREE.Fog(0xffffff, 46, 140);

  const ramps = {
    zenith: makeRamp(ZENITH), horizon: makeRamp(HORIZON), sunlight: makeRamp(SUNLIGHT), clouds: makeRamp(CLOUDS),
  };
  const sunDir = new THREE.Vector3();
  const moonTint = new THREE.Color(0x8fa6ff);
  let phase = startPhase;

  return {
    sunDir,
    // Azimut del sol: hacia ahí miran los girasoles. Es continuo también bajo el horizonte.
    get sunYaw() {
      return Math.atan2(sunDir.x, sunDir.z);
    },
    update(dt, time, camera) {
      phase = (phase + dt / cycleSeconds) % 1;
      const angle =
        phase < DAY_SHARE
          ? (phase / DAY_SHARE) * Math.PI
          : Math.PI + ((phase - DAY_SHARE) / (1 - DAY_SHARE)) * Math.PI;
      sunDir.set(Math.cos(angle), Math.sin(angle) * Math.cos(SUN_TILT), Math.sin(angle) * Math.sin(SUN_TILT));
      const e = sunDir.y;
      const night = THREE.MathUtils.smoothstep(-e, 0.0, 0.25);

      const u = dome.material.uniforms;
      ramps.zenith(e, u.uTop.value);
      ramps.horizon(e, u.uHorizon.value);
      u.uSunDir.value.copy(sunDir);
      u.uGlowAmount.value = 1.1 * (1 - THREE.MathUtils.smoothstep(Math.abs(e), 0.05, 0.45));
      scene.fog.color.copy(u.uHorizon.value);

      // De día alumbra el sol; de noche, una luna tenue desde el lado contrario.
      const daylight = THREE.MathUtils.smoothstep(e, -0.04, 0.3);
      if (e > -0.04) {
        ramps.sunlight(e, sunLight.color);
        sunLight.intensity = 0.25 + daylight * 2.6;
        sunLight.position.copy(camera.position).addScaledVector(sunDir, 50);
      } else {
        sunLight.color.copy(moonTint);
        sunLight.intensity = 0.25 + night * 0.35;
        sunLight.position.copy(camera.position).addScaledVector(sunDir, -50);
      }
      sunLight.target.position.copy(camera.position);
      // Luz ambiente: el color del cielo, aclarado para que el campo no se apague al atardecer.
      hemi.color.copy(u.uTop.value).lerp(u.uHorizon.value, 0.5).lerp(WHITE, 0.15 + daylight * 0.35);
      hemi.intensity = 1.0 + daylight * 1.0;

      group.position.copy(camera.position);
      sun.position.copy(sunDir).multiplyScalar(FAR);
      moon.position.copy(sunDir).multiplyScalar(-FAR);
      sun.lookAt(camera.position);
      moon.lookAt(camera.position);
      // Bajo el horizonte se desvanecen: el borde del mundo no llega a taparlos.
      sun.material.opacity = THREE.MathUtils.smoothstep(e, -0.14, -0.02);
      moon.material.opacity = THREE.MathUtils.smoothstep(-e, -0.14, -0.02);
      stars.material.opacity = night;
      stars.rotation.z = time * 0.004;

      ramps.clouds(e, clouds.material.color);
      clouds.update(time);
    },
  };
}
