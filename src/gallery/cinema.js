import * as THREE from 'three';
import { presetUrls } from './frames.js';

// Si hay un video en /videos, el proyector pasa ese; si no, monta una "película" con las fotos.
const videoFiles = import.meta.glob('/videos/*.{mp4,webm,m4v,MP4,WEBM}', { eager: true, query: '?url', import: 'default' });
const videoUrl = Object.keys(videoFiles).sort().map((key) => videoFiles[key])[0];

const WIDTH = 640;
const HEIGHT = 360;
const TITLE_SECONDS = 3;
const FADE_SECONDS = 1.2;
const FRAME_INTERVAL = 1 / 24; // la película de fotos se redibuja a 24 fps, como el cine

export function createCinema({ screen, lens, projector, roomLight }, { title, secondsPerPhoto }) {
  const group = new THREE.Group();
  let playing = false;

  // --- La imagen: un canvas (pantalla apagada, título y pase de fotos) o el video ---------
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  const canvasTexture = new THREE.CanvasTexture(canvas);
  canvasTexture.colorSpace = THREE.SRGBColorSpace;

  let video = null;
  let videoTexture = null;
  if (videoUrl) {
    video = document.createElement('video');
    video.src = videoUrl;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
  }

  // Las fotos originales pueden ser enormes: solo se tienen cargadas la que se ve y sus vecinas.
  const photos = presetUrls;
  const loaded = new Map(); // índice → Image
  function photoAt(index) {
    for (const key of loaded.keys()) {
      const gap = Math.abs(key - index);
      if (gap > 1 && gap < photos.length - 1) loaded.delete(key);
    }
    for (const i of [index, (index + 1) % photos.length]) {
      if (loaded.has(i)) continue;
      const img = new Image();
      img.src = photos[i];
      loaded.set(i, img);
    }
    return loaded.get(index);
  }

  function drawOff() {
    ctx.fillStyle = '#b9b6ae';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    canvasTexture.needsUpdate = true;
  }

  // Foto encajada entera en la pantalla, con un zoom lento para que parezca cine.
  function drawPhoto(img, progress, alpha) {
    if (!img.complete || !img.naturalWidth) return;
    const fit = Math.min(WIDTH / img.naturalWidth, HEIGHT / img.naturalHeight) * (1 + progress * 0.08);
    const w = img.naturalWidth * fit;
    const h = img.naturalHeight * fit;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
    ctx.globalAlpha = 1;
  }

  function drawTitle(alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f6e6b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '64px VT323, monospace';
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2);
    ctx.globalAlpha = 1;
  }

  function drawFilm(t) {
    ctx.fillStyle = '#0c0a08';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (t < TITLE_SECONDS || photos.length === 0) {
      const fadeOut = photos.length ? Math.min(1, (TITLE_SECONDS - t) / FADE_SECONDS) : 1;
      drawTitle(Math.min(1, t / FADE_SECONDS, fadeOut));
    } else {
      const reel = (t - TITLE_SECONDS) / secondsPerPhoto;
      const index = Math.floor(reel) % photos.length;
      const progress = reel % 1;
      const fadeIn = Math.min(1, (progress * secondsPerPhoto) / FADE_SECONDS);
      // Fundido encadenado: la anterior se queda debajo mientras entra la nueva.
      const previous = loaded.get((index + photos.length - 1) % photos.length);
      if (fadeIn < 1 && reel >= 1 && previous) drawPhoto(previous, 1, 1);
      drawPhoto(photoAt(index), progress, fadeIn);
    }
    // Un poco de grano de proyector.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * WIDTH, Math.random() * HEIGHT, 2, 2);
    canvasTexture.needsUpdate = true;
  }

  const material = new THREE.MeshBasicMaterial({ map: canvasTexture });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(screen.width, screen.height), material);
  screenMesh.position.set(screen.x, screen.y, screen.z);
  screenMesh.rotation.y = Math.PI / 2; // mira a +X, hacia la cama
  group.add(screenMesh);
  drawOff();

  // --- El haz de luz: una pirámide translúcida del objetivo a las esquinas de la pantalla ---
  const hw = screen.width / 2;
  const hh = screen.height / 2;
  const corners = [[-hh, -hw], [-hh, hw], [hh, hw], [hh, -hw]].map(([dy, dz]) => [screen.x + 0.02, screen.y + dy, screen.z + dz]);
  const beamPositions = [];
  for (let i = 0; i < 4; i++) beamPositions.push(...lens.toArray(), ...corners[i], ...corners[(i + 1) % 4]);
  const beamGeometry = new THREE.BufferGeometry();
  beamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(beamPositions, 3));
  const beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({
    color: 0xfff0c8, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  beam.visible = false;
  group.add(beam);

  const brightRoom = roomLight.intensity;
  let filmTime = 0;
  let sinceFrame = 0;
  screenMesh.userData.cinema = true;
  projector.userData.cinema = true;

  return {
    group,
    targets: [screenMesh, projector],
    get playing() {
      return playing;
    },
    hasSound: Boolean(video), // un video trae su propio audio; el pase de fotos es mudo
    toggle() {
      playing = !playing;
      beam.visible = playing;
      roomLight.intensity = playing ? brightRoom * 0.2 : brightRoom; // se apaga casi toda la luz
      if (video) {
        material.map = playing ? videoTexture : canvasTexture;
        material.needsUpdate = true;
        if (playing) video.play().catch(() => {});
        else video.pause();
      } else if (playing) {
        filmTime = 0;
      }
      if (!playing) drawOff();
    },
    update(dt) {
      if (!playing || video) return;
      filmTime += dt;
      sinceFrame += dt;
      if (sinceFrame < FRAME_INTERVAL) return;
      sinceFrame = 0;
      drawFilm(filmTime);
    },
  };
}
