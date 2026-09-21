import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../util/random.js';
import { TURKEY_YARD } from './layout.js';

const WALK = 0.9;
const FLEE = 2.6;
const SHY_DISTANCE = 2.2; // si ella se acerca más, se apartan trotando

// Caja de un color (por vértice), para fundir varias en una sola malla.
function part(size, at, color, tiltX = 0) {
  const geometry = new THREE.BoxGeometry(...size);
  if (tiltX) geometry.rotateX(tiltX);
  geometry.translate(...at);
  const c = new THREE.Color(color);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Guajolote de bloques mirando a +Z. El macho abre la cola en abanico; las hembras son
// más pequeñas, más claras y con la cola recogida.
function buildTurkey(material, male) {
  const feathers = male ? 0x3a2a20 : 0x6a5442;
  const body = mergeGeometries([
    part([0.5, 0.45, 0.7], [0, 0.62, 0], feathers),
    part([0.08, 0.34, 0.5], [-0.29, 0.62, -0.02], male ? 0x57402f : 0x7d6652), // alas
    part([0.08, 0.34, 0.5], [0.29, 0.62, -0.02], male ? 0x57402f : 0x7d6652),
    ...(male
      ? [
          part([0.95, 0.75, 0.06], [0, 1.0, -0.4], 0x4a3324, -0.25), // cola en abanico…
          part([0.95, 0.12, 0.07], [0, 1.36, -0.49], 0xd8c8a8, -0.25), // …con el borde claro
        ]
      : [part([0.4, 0.3, 0.3], [0, 0.78, -0.45], 0x57402f, -0.5)]),
  ]);
  const head = mergeGeometries([
    part([0.14, 0.42, 0.14], [0, 0.2, 0], male ? 0xb8433a : 0x8a8f98), // cuello
    part([0.18, 0.18, 0.2], [0, 0.46, 0.03], male ? 0x7fb2d6 : 0x9aa6b0), // cabeza azulada
    part([0.07, 0.06, 0.12], [0, 0.44, 0.18], 0xe0b040), // pico
    part([0.06, male ? 0.22 : 0.1, 0.05], [0, male ? 0.33 : 0.38, 0.16], 0xd02a2a), // moco
  ]);

  const group = new THREE.Group();
  const bodyMesh = new THREE.Mesh(body, material);
  const headMesh = new THREE.Mesh(head, material);
  headMesh.position.set(0, 0.78, 0.33);
  const legs = [-0.12, 0.12].map((x) => {
    const leg = new THREE.Mesh(part([0.06, 0.4, 0.06], [0, -0.2, 0], 0xc98a4a), material);
    leg.position.set(x, 0.4, 0); // el giro sale de la cadera
    return leg;
  });
  group.add(bodyMesh, headMesh, ...legs);
  group.scale.setScalar(male ? 1.1 : 0.85);
  return { group, bodyMesh, headMesh, legs };
}

export function createTurkeys(count = 6) {
  const rng = mulberry32(55);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const group = new THREE.Group();

  const randomSpot = () => {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * TURKEY_YARD.radius;
    return [TURKEY_YARD.x + Math.cos(a) * r, TURKEY_YARD.z + Math.sin(a) * r];
  };

  const flock = [];
  for (let i = 0; i < count; i++) {
    const turkey = buildTurkey(material, i < 2);
    const [x, z] = randomSpot();
    turkey.group.position.set(x, 0, z);
    Object.assign(turkey, { target: randomSpot(), pause: rng() * 3, heading: rng() * 6, stride: rng() * 6, pecking: false, hop: 0 });
    turkey.bodyMesh.userData.turkey = turkey;
    turkey.headMesh.userData.turkey = turkey;
    group.add(turkey.group);
    flock.push(turkey);
  }

  return {
    group,
    targets: flock.flatMap((t) => [t.bodyMesh, t.headMesh]),
    // Al tocarlo pega un brinco del susto.
    startle(turkey) {
      turkey.hop = 1;
      turkey.pause = 0;
      turkey.target = randomSpot();
    },
    update(dt, time, playerPosition) {
      for (const t of flock) {
        const pos = t.group.position;
        const fromPlayerX = pos.x - playerPosition.x;
        const fromPlayerZ = pos.z - playerPosition.z;
        const shy = Math.hypot(fromPlayerX, fromPlayerZ) < SHY_DISTANCE;
        if (shy) {
          // Huye en dirección contraria, sin salirse del claro.
          const len = Math.hypot(fromPlayerX, fromPlayerZ) || 1;
          let tx = pos.x + (fromPlayerX / len) * 3;
          let tz = pos.z + (fromPlayerZ / len) * 3;
          const out = Math.hypot(tx - TURKEY_YARD.x, tz - TURKEY_YARD.z) / TURKEY_YARD.radius;
          if (out > 1) {
            tx = TURKEY_YARD.x + (tx - TURKEY_YARD.x) / out;
            tz = TURKEY_YARD.z + (tz - TURKEY_YARD.z) / out;
          }
          t.target = [tx, tz];
          t.pause = 0;
        }

        let moving = false;
        if (t.pause > 0) {
          t.pause -= dt;
        } else {
          const dx = t.target[0] - pos.x;
          const dz = t.target[1] - pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.15) {
            // Llegó: se queda un rato quieto (a veces picoteando) y elige otro sitio.
            t.pause = 1.5 + rng() * 5;
            t.pecking = rng() < 0.6;
            t.target = randomSpot();
          } else {
            const speed = shy ? FLEE : WALK;
            const step = Math.min(dist, speed * dt);
            pos.x += (dx / dist) * step;
            pos.z += (dz / dist) * step;
            // Gira hacia donde camina, por el lado corto.
            const wanted = Math.atan2(dx, dz);
            const turn = Math.atan2(Math.sin(wanted - t.heading), Math.cos(wanted - t.heading));
            t.heading += turn * Math.min(1, dt * 6);
            t.stride += step * 7;
            moving = true;
          }
        }

        t.hop = Math.max(0, t.hop - dt * 2.2);
        pos.y = Math.sin((1 - t.hop) * Math.PI) * 0.5 * (t.hop > 0 ? 1 : 0);
        t.group.rotation.y = t.heading;
        const swing = moving ? Math.sin(t.stride) * 0.6 : 0;
        t.legs[0].rotation.x = swing;
        t.legs[1].rotation.x = -swing;
        // Cabeceo al andar; parado, picotea el suelo o mira alrededor.
        const pecks = !moving && t.pecking ? Math.max(0, Math.sin(time * 5 + t.stride)) * 1.1 : 0;
        t.headMesh.rotation.x = moving ? Math.sin(t.stride * 2) * 0.12 : pecks;
        t.headMesh.rotation.y = !moving && !t.pecking ? Math.sin(time * 0.9 + t.stride) * 0.6 : 0;
      }
    },
  };
}

// «Gordo-gordo-gordo»: un tono que baja con un trémolo rápido. Sin archivos de audio.
let audio;
export function gobble() {
  try {
    audio ??= new AudioContext();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.7);
    const tremolo = audio.createOscillator();
    tremolo.frequency.value = 17;
    const depth = audio.createGain();
    depth.gain.value = 0.12;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.75);
    tremolo.connect(depth).connect(gain.gain);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    osc.connect(filter).connect(gain).connect(audio.destination);
    osc.start(now);
    tremolo.start(now);
    osc.stop(now + 0.8);
    tremolo.stop(now + 0.8);
  } catch {
    // Sin audio no pasa nada.
  }
}
