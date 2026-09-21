// Controles táctiles: el primer dedo en la mitad izquierda es un joystick para caminar,
// cualquier otro arrastra la mirada, y un toque corto sin moverse es un "clic".
const STICK_RADIUS = 56;
const LOOK_SENSITIVITY = 0.0052;
const TAP_MS = 280;
const TAP_SLOP = 12;

export function createTouchControls(surface, player, { onTap }) {
  const base = document.getElementById('stick-base');
  const knob = document.getElementById('stick-knob');
  const touches = new Map(); // identifier → { role, startX, startY, lastX, lastY, startedAt, moved }
  let enabled = false;

  const stickTouch = () => [...touches.values()].find((t) => t.role === 'stick');

  function showStick(t, x, y) {
    base.style.display = knob.style.display = 'block';
    base.style.transform = `translate(${t.startX}px, ${t.startY}px)`;
    knob.style.transform = `translate(${x}px, ${y}px)`;
  }

  function hideStick() {
    base.style.display = knob.style.display = 'none';
    player.setTouchMove(0, 0);
  }

  surface.addEventListener('touchstart', (e) => {
    if (!enabled) return;
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const role = touch.clientX < window.innerWidth / 2 && !stickTouch() ? 'stick' : 'look';
      const t = {
        role, startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, lastY: touch.clientY,
        startedAt: performance.now(), moved: false,
      };
      touches.set(touch.identifier, t);
      if (role === 'stick') showStick(t, t.startX, t.startY);
    }
  }, { passive: false });

  surface.addEventListener('touchmove', (e) => {
    if (!enabled) return;
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const t = touches.get(touch.identifier);
      if (!t) continue;
      if (Math.hypot(touch.clientX - t.startX, touch.clientY - t.startY) > TAP_SLOP) t.moved = true;
      if (t.role === 'stick') {
        let dx = touch.clientX - t.startX;
        let dy = touch.clientY - t.startY;
        const len = Math.hypot(dx, dy);
        if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; }
        player.setTouchMove(dx / STICK_RADIUS, -dy / STICK_RADIUS);
        showStick(t, t.startX + dx, t.startY + dy);
      } else {
        player.look(touch.clientX - t.lastX, touch.clientY - t.lastY, LOOK_SENSITIVITY);
      }
      t.lastX = touch.clientX;
      t.lastY = touch.clientY;
    }
  }, { passive: false });

  function end(e) {
    for (const touch of e.changedTouches) {
      const t = touches.get(touch.identifier);
      if (!t) continue;
      touches.delete(touch.identifier);
      if (t.role === 'stick') hideStick();
      const quick = performance.now() - t.startedAt < TAP_MS;
      if (enabled && e.type === 'touchend' && quick && !t.moved) onTap(touch.clientX, touch.clientY);
    }
  }
  surface.addEventListener('touchend', end);
  surface.addEventListener('touchcancel', end);

  return {
    setEnabled(value) {
      enabled = value;
      if (!value) {
        touches.clear();
        hideStick();
      }
    },
  };
}
