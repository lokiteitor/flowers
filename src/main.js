import * as THREE from 'three';
import '@fontsource/vt323';
import './style.css';
import { config } from './config.js';
import { createTerrain } from './world/terrain.js';
import { createSunflowers } from './world/sunflowers.js';
import { createHouse } from './world/house.js';
import { createSky } from './world/sky.js';
import { HOUSE, SPAWN } from './world/layout.js';
import { createPlayer } from './player/controls.js';
import { createTouchControls } from './player/touch.js';
import { createGallery } from './gallery/frames.js';
import { createLightbox } from './gallery/lightbox.js';
import { createWelcome } from './ui/welcome.js';

const REACH = 5; // distancia máxima para interactuar con un cuadro
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
const sunflowers = createSunflowers({
  spacing: coarsePointer ? config.flowerSpacingMobile : config.flowerSpacing,
  treeSpots: terrain.treeSpots,
});
scene.add(terrain.group, house.group, sunflowers.group);
const sky = createSky(scene, {
  cycleSeconds: config.dayCycleSeconds,
  startPhase: debug.has('phase') ? Number(debug.get('phase')) : config.startPhase,
});

const player = createPlayer(camera, canvas, [...house.colliders, ...terrain.colliders]);
const gallery = await createGallery(scene, {
  spareFrames: config.spareFrames,
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

let state = 'welcome'; // welcome | playing | paused | lightbox | debug
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

function activate(frame) {
  if (frame.photo) {
    state = 'lightbox';
    player.setEnabled(false);
    touch.setEnabled(false);
    player.unlock();
    lightbox.open(frame.photo);
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
raycaster.far = REACH;
const pointer = new THREE.Vector2();

function frameAt(ndcX, ndcY) {
  // Solo desde dentro de la casita: así no se "ve" un cuadro a través de la pared.
  const p = player.position;
  if (Math.abs(p.x) > HOUSE.halfX - 1 || Math.abs(p.z) > HOUSE.halfZ) return null;
  raycaster.setFromCamera(pointer.set(ndcX, ndcY), camera);
  return raycaster.intersectObjects(gallery.targets, false)[0]?.object.userData.frame ?? null;
}

canvas.addEventListener('click', () => {
  if (state !== 'playing' || touchMode) return;
  const frame = frameAt(0, 0);
  if (frame) activate(frame);
});

const touch = createTouchControls(canvas, player, {
  onTap(x, y) {
    if (state !== 'playing') return;
    const frame = frameAt((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    if (frame) activate(frame);
  },
});

function updateHover() {
  const frame = state === 'playing' && !touchMode ? frameAt(0, 0) : null;
  gallery.setHovered(frame);
  ui.crosshair.classList.toggle('active', Boolean(frame));
  ui.hint.textContent = !frame ? '' : frame.photo ? 'Clic para ver' : 'Clic para colocar una foto';
}

// --- Entrada -----------------------------------------------------------------------

createWelcome(config.letter, ({ touch: isTouch }) => {
  touchMode = isTouch;
  document.body.classList.toggle('touch', touchMode);
  ui.tips.textContent = touchMode
    ? 'Lado izquierdo: caminar · Arrastra para mirar · Toca un cuadro'
    : 'WASD para caminar · Ratón para mirar · Esc para pausar';
  setTimeout(() => ui.tips.classList.add('faded'), 9000);
  player.teleport(SPAWN.x, SPAWN.z);
  resume();
});

if (debug.has('view')) {
  // Solo en desarrollo: ?view=field|inside|left|right (y ?phase=0…1) para revisar sin jugar.
  const views = {
    field: [SPAWN.x, SPAWN.z, 0],
    inside: [0, 3, 0],
    left: [1, 0, Math.PI / 2],
    right: [-1, 0, -Math.PI / 2],
    out: [0, 2, Math.PI],
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
    camera.position.set(Math.sin(angle) * 27, 8, Math.cos(angle) * 27);
    camera.lookAt(0, 3, 0);
  } else {
    player.update(dt);
    updateHover();
  }

  sky.update(dt, time, camera);
  sunflowers.update(time, sky.sunYaw);
  renderer.render(scene, camera);
});
