import * as THREE from 'three';
import '@fontsource/vt323';
import './style.css';
import { config } from './config.js';
import { createTerrain } from './world/terrain.js';
import { createSunflowers } from './world/sunflowers.js';
import { createHouse } from './world/house.js';
import { createSky } from './world/sky.js';
import { createRiverscape } from './world/riverscape.js';
import { createGarden } from './world/garden.js';
import { createHuerto } from './world/huerto.js';
import { createTrees } from './world/trees.js';
import { createEdibles } from './world/edibles.js';
import { createTurkeys, gobble } from './world/turkeys.js';
import { HOUSE, SPAWN } from './world/layout.js';
import { createPlayer } from './player/controls.js';
import { createTouchControls } from './player/touch.js';
import { createGallery } from './gallery/frames.js';
import { createLightbox } from './gallery/lightbox.js';
import { createCinema } from './gallery/cinema.js';
import { createWelcome } from './ui/welcome.js';
import { createNote } from './ui/note.js';
import { createAmbience } from './audio/ambience.js';

const REACH = 4; // distancia máxima para interactuar con algo dentro de la casa
const REACH_OUTDOORS = 3.9; // los frutos de los árboles cuelgan más alto
const coarsePointer = matchMedia('(pointer: coarse)').matches;
const debug = import.meta.env.DEV ? new URLSearchParams(location.search) : new URLSearchParams();

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarsePointer, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 600);

const terrain = createTerrain();
const house = createHouse();
const river = createRiverscape();
const garden = createGarden();
const huerto = createHuerto();
const trees = createTrees();
const turkeys = createTurkeys();
const cinema = createCinema(house.cinema, config.movie);
const ambience = createAmbience();
const sunflowers = createSunflowers({
  spacing: coarsePointer ? config.flowerSpacingMobile : config.flowerSpacing,
  treeSpots: trees.spots,
});
scene.add(terrain.group, trees.group, turkeys.group, cinema.group, house.group, river.group, garden.group, huerto.group, sunflowers.group);
const sky = createSky(scene, {
  cycleSeconds: config.dayCycleSeconds,
  startPhase: debug.has('phase') ? Number(debug.get('phase')) : config.startPhase,
});

const player = createPlayer(camera, canvas, [
  ...house.colliders, ...trees.colliders, ...river.colliders, ...garden.colliders, ...huerto.colliders,
]);
const gallery = await createGallery(scene, {
  slots: house.frameSlots,
  maxTextureSize: coarsePointer ? 768 : 1024,
  maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
});

// --- Estado e interfaz -------------------------------------------------------------

const ui = {
  hud: document.getElementById('hud'),
  crosshair: document.getElementById('crosshair'),
  hint: document.getElementById('hint'),
  tips: document.getElementById('tips'),
  pause: document.getElementById('pause'),
  toast: document.getElementById('toast'),
  fileInput: document.getElementById('file-input'),
};

let state = 'welcome'; // welcome | playing | paused | reading (foto o cartita abierta) | debug
let touchMode = false;
let pendingSlot = null;
let toastTimer;

function toast(message, ms = 2600) {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.toast.hidden = true), ms);
}

function play() {
  state = 'playing';
  ui.pause.hidden = true;
  ui.hud.hidden = false;
  player.setEnabled(true);
  touch.setEnabled(touchMode);
}

function pause() {
  state = 'paused';
  ui.pause.hidden = false;
  player.setEnabled(false);
}

// En escritorio se juega con el ratón capturado; si el navegador lo niega, queda en pausa.
async function resume() {
  if (touchMode) play();
  else if (!(await player.lock())) pause();
}

player.onLockChange((locked) => {
  if (locked) play();
  else if (state === 'playing') pause();
});
document.getElementById('resume').addEventListener('click', resume);

const lightbox = createLightbox({
  onClose: resume,
  onRemove: (photo) => gallery.remove(photo).then(() => toast('Foto quitada')),
});

const note = createNote(config.tableLetter, { onClose: resume });

// Abre algo por encima del juego (una foto o la cartita) soltando el ratón sin pasar por la pausa.
function read(open) {
  state = 'reading';
  player.setEnabled(false);
  touch.setEnabled(false);
  player.unlock();
  open();
}

function activate(target) {
  if (target.letter) read(() => note.open());
  else if (target.edible) toast(edibles.eat(target.hit));
  else if (target.cinema) cinema.toggle();
  else if (target.turkey) {
    turkeys.startle(target.turkey);
    gobble();
    toast('¡Gordo-gordo-gordo!');
  }
  else activateFrame(target.frame);
}

function activateFrame(frame) {
  if (frame.photo) {
    read(() => lightbox.open(frame.photo));
  } else {
    pendingSlot = frame.index;
    player.unlock();
    ui.fileInput.click();
  }
}

ui.fileInput.addEventListener('change', async () => {
  const file = ui.fileInput.files[0];
  ui.fileInput.value = '';
  if (!file) return;
  toast('Colocando la foto…', 10000);
  try {
    await gallery.upload(file, pendingSlot);
    toast('¡Foto colocada!');
  } catch (error) {
    console.warn(error);
    toast('No se pudo usar esa imagen');
  }
});

// --- Apuntar a los cuadros ---------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

house.letter.userData.letter = true;

const edibles = createEdibles();
for (const [mesh, name] of [...trees.edible, ...huerto.edible]) edibles.add(mesh, name);
for (const [mesh, name] of house.basketFruit) edibles.add(mesh, name, { indoor: true });

// Lo que hay bajo el punto de mira (o bajo el dedo): portarretratos, cartita, algo de comer… o nada.
// Dentro de la casa solo cuenta lo de dentro y fuera solo lo de fuera: nada se "toca" a través de la pared.
function isIndoors() {
  const p = player.position;
  return Math.abs(p.x) < HOUSE.halfX - 1 && Math.abs(p.z) < HOUSE.halfZ;
}

function targetAt(ndcX, ndcY) {
  const indoors = isIndoors();
  raycaster.far = indoors ? REACH : REACH_OUTDOORS;
  raycaster.setFromCamera(pointer.set(ndcX, ndcY), camera);
  const objects = indoors
    ? [...gallery.targets, house.letter, ...cinema.targets, ...edibles.targets('indoor')]
    : [...edibles.targets('outdoor'), ...turkeys.targets];
  const hit = raycaster.intersectObjects(objects, false)[0];
  return hit ? { ...hit.object.userData, hit } : null;
}

// En las vistas de depuración también se puede hacer clic, para probar sin capturar el ratón.
const canInteract = () => state === 'playing' || state === 'debug';

canvas.addEventListener('click', () => {
  if (!canInteract() || touchMode) return;
  const target = targetAt(0, 0);
  if (target) activate(target);
});

const touch = createTouchControls(canvas, player, {
  onTap(x, y) {
    if (state !== 'playing') return;
    const target = targetAt((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    if (target) activate(target);
  },
});

function updateHover() {
  const target = canInteract() && !touchMode ? targetAt(0, 0) : null;
  gallery.setHovered(target?.frame ?? null);
  ui.crosshair.classList.toggle('active', Boolean(target));
  ui.hint.textContent = !target
    ? ''
    : target.letter
      ? 'Clic para leer la cartita'
      : target.edible
        ? `Clic para comer: ${target.edible}`
      : target.cinema
        ? cinema.playing ? 'Clic para apagar el proyector' : 'Clic para ver la película'
      : target.turkey
        ? 'Clic para saludar al guajolote'
      : target.frame.photo
        ? 'Clic para ver'
        : 'Clic para colocar una foto';
}

// --- Entrada -----------------------------------------------------------------------

createWelcome(config.letter, ({ touch: isTouch }) => {
  touchMode = isTouch;
  document.body.classList.toggle('touch', touchMode);
  ui.tips.textContent = touchMode
    ? 'Lado izquierdo: caminar · Arrastra para mirar · Toca un portarretratos'
    : 'WASD para caminar · Ratón para mirar · Esc para pausar';
  setTimeout(() => ui.tips.classList.add('faded'), 9000);
  player.teleport(SPAWN.x, SPAWN.z);
  ambience.start();
  resume();
});

if (debug.has('view')) {
  // Solo en desarrollo: ?view=<nombre> (y ?phase=0…1) para revisar escenas sin jugar.
  const views = {
    field: [SPAWN.x, SPAWN.z, 0],
    river: [0.9, 23, -Math.PI / 2, -0.3],
    garden: [0, 17.5, 0, -0.1],
    dining: [0.5, 5, 0.75, -0.25],
    table: [-2.6, 3.9, 0.25, -0.45],
    kitchen: [0, -1, 1.15, -0.2],
    bedroom: [3.6, 4, -0.35, -0.2],
    frames: [-5, 3.2, Math.PI / 2, -0.35],
    photo: [-5.4, 3.4, Math.PI / 2, -0.14],
    letter: [-2.75, 3.45, 0, -0.38],
    out: [0, 5, Math.PI],
    cinema: [6.6, -1.2, Math.PI / 2, 0.12],
    librero: [6.2, 3.2, 1.35, 0],
    turkeys: [11.5, 2, -Math.PI / 2, -0.12],
    huerto: [0, -8.2, 0, -0.32],
    backdoor: [0, -3, 0, -0.05],
    papaya: [-10.6, -12.5, 1.1, 0.45],
    fig: [11.5, 14.5, -2.2, 0.15],
    basket: [-4.6, 3.5, 0.05, -0.15],
    melon: [2.95, -14.3, 0, -0.67],
    tomato: [3.2, -10.6, 0.15, -0.62],
  };
  document.getElementById('welcome').hidden = true;
  player.teleport(...(views[debug.get('view')] ?? views.field));
  state = 'debug';
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Bucle -------------------------------------------------------------------------

const timer = new THREE.Timer();
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const time = timer.getElapsed();

  if (state === 'welcome') {
    // Tras la carta, la cámara rodea despacio la casita.
    const angle = time * 0.05 + 0.6;
    camera.position.set(Math.sin(angle) * 34, 10, Math.cos(angle) * 34);
    camera.lookAt(0, 3, 0);
  } else {
    player.update(dt);
    updateHover();
  }

  sky.update(dt, time, camera);
  sunflowers.update(time, sky.sunYaw);
  river.update(time);
  edibles.update(time);
  turkeys.update(dt, time, state === 'welcome' ? camera.position : player.position);
  cinema.update(dt);
  ambience.update(dt, { indoors: state !== 'welcome' && isIndoors(), ducked: cinema.playing && cinema.hasSound });
  renderer.render(scene, camera);
});
