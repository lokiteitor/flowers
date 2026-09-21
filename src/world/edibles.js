import * as THREE from 'three';

const REGROW_SECONDS = 80;

// Lo que ella dice al comerse cada cosa.
const BITES = {
  mango: '¡Ñam! Un mango dulcísimo',
  higo: '¡Ñam! Un higo maduro',
  papaya: '¡Ñam! Una papaya fresquita',
  tomate: '¡Ñam! Un tomate recién cortado',
  chile: '¡Uf, cómo pica este chile!',
  acelga: 'Crunch… una acelga muy sana',
  melón: '¡Ñam! Un melón enterito',
  calabacita: '¡Ñam! Una calabacita tierna',
};

// Mordiscos sintetizados: tres ráfagas cortas de ruido filtrado. Sin archivos de audio.
let audio;
function munch() {
  try {
    audio ??= new AudioContext();
    const length = Math.floor(audio.sampleRate * 0.07);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    for (let bite = 0; bite < 3; bite++) {
      const source = audio.createBufferSource();
      source.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900 + bite * 250;
      const gain = audio.createGain();
      gain.gain.value = 0.35;
      source.connect(filter).connect(gain).connect(audio.destination);
      source.start(audio.currentTime + bite * 0.13);
    }
  } catch {
    // Sin audio no pasa nada: comer sigue funcionando.
  }
}

// Registro de todo lo comestible. Cada entrada es una malla normal (se oculta al comerla) o un
// InstancedMesh (se encoge a cero la instancia mordida). Lo comido vuelve a crecer al rato.
export function createEdibles() {
  const meshes = { indoor: [], outdoor: [] };
  const regrowing = []; // { at, restore }
  const nothing = new THREE.Matrix4().makeScale(0, 0, 0);
  let now = 0;

  return {
    add(mesh, name, { indoor = false } = {}) {
      mesh.userData.edible = name;
      meshes[indoor ? 'indoor' : 'outdoor'].push(mesh);
    },
    targets: (where) => meshes[where].filter((mesh) => mesh.visible),
    // `hit` es la intersección del raycaster. Devuelve el mensaje para mostrar.
    eat(hit) {
      const mesh = hit.object;
      if (mesh.isInstancedMesh) {
        const id = hit.instanceId;
        const original = new THREE.Matrix4();
        mesh.getMatrixAt(id, original);
        mesh.setMatrixAt(id, nothing);
        mesh.instanceMatrix.needsUpdate = true;
        regrowing.push({
          at: now + REGROW_SECONDS,
          restore() {
            mesh.setMatrixAt(id, original);
            mesh.instanceMatrix.needsUpdate = true;
          },
        });
      } else {
        mesh.visible = false;
        regrowing.push({ at: now + REGROW_SECONDS, restore: () => (mesh.visible = true) });
      }
      munch();
      return BITES[mesh.userData.edible] ?? '¡Ñam!';
    },
    update(time) {
      now = time;
      while (regrowing.length && regrowing[0].at <= now) regrowing.shift().restore();
    },
  };
}
