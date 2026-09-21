import ambienceUrl from '../assets/ambience.mp3';

const OUTDOORS = 0.55;
const INDOORS = 0.22; // dentro de la casita se oye amortiguado
const DUCKED = 0.06; // casi en silencio mientras suena un video en el proyector

// Sonido ambiente en bucle. Arranca con el clic de "Entrar" (los navegadores no dejan sonar
// nada antes de un gesto) y sube de volumen poco a poco. Se silencia con la tecla M o el botón.
export function createAmbience() {
  const audio = new Audio(ambienceUrl);
  audio.loop = true;
  audio.preload = 'auto';
  // El volumen se controla con un nodo de ganancia: en iOS `audio.volume` no se puede cambiar.
  let gain = null;

  const button = document.getElementById('mute');
  let muted = false;
  let started = false;

  function setMuted(value) {
    muted = value;
    button.classList.toggle('off', muted);
    button.setAttribute('aria-pressed', String(muted));
  }

  button.addEventListener('click', () => {
    setMuted(!muted);
    button.blur(); // si se queda con el foco, la barra espaciadora (saltar) lo volvería a pulsar
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && started) setMuted(!muted);
  });
  // Al cambiar de pestaña o bloquear el móvil, que no siga sonando.
  document.addEventListener('visibilitychange', () => {
    if (!started) return;
    if (document.hidden) audio.pause();
    else audio.play().catch(() => {});
  });

  return {
    start() {
      if (started) return;
      started = true;
      button.hidden = false;
      try {
        const context = new AudioContext();
        gain = context.createGain();
        gain.gain.value = 0;
        context.createMediaElementSource(audio).connect(gain).connect(context.destination);
      } catch {
        gain = null; // sin Web Audio suena igual, solo que a volumen fijo
      }
      audio.play().catch(() => {});
    },
    // Cada fotograma: el volumen se desliza hacia el que toca según dónde esté ella.
    update(dt, { indoors, ducked }) {
      if (!started) return;
      const target = muted ? 0 : ducked ? DUCKED : indoors ? INDOORS : OUTDOORS;
      if (gain) gain.gain.value += (target - gain.gain.value) * (1 - Math.exp(-1.5 * dt));
      else audio.muted = muted;
    },
  };
}
