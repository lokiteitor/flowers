import * as THREE from 'three';
import { resolveCollisions } from './collision.js';
import { PLAYER, SPAWN } from '../world/layout.js';

const WALK = 4.3;
const SPRINT = 6.4;
const JUMP = 7.6;
const GRAVITY = 24;
const MOUSE_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.05;

const KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createPlayer(camera, element, colliders) {
  const position = new THREE.Vector3(SPAWN.x, 0, SPAWN.z); // pies
  const velocity = new THREE.Vector3();
  const pressed = new Set();
  const touchMove = new THREE.Vector2();
  const lockListeners = [];
  let yaw = 0;
  let pitch = 0;
  let onGround = true;
  let bob = 0;
  let enabled = false;

  camera.rotation.order = 'YXZ';

  function look(dx, dy, sensitivity = MOUSE_SENSITIVITY) {
    yaw -= dx * sensitivity;
    pitch = THREE.MathUtils.clamp(pitch - dy * sensitivity, -MAX_PITCH, MAX_PITCH);
  }

  document.addEventListener('keydown', (e) => {
    if (!enabled) return;
    pressed.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  document.addEventListener('keyup', (e) => pressed.delete(e.code));
  window.addEventListener('blur', () => pressed.clear());
  document.addEventListener('mousemove', (e) => {
    if (enabled && document.pointerLockElement === element) look(e.movementX, e.movementY);
  });
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === element;
    if (!locked) pressed.clear();
    lockListeners.forEach((fn) => fn(locked));
  });

  return {
    position,
    look,
    setTouchMove: (x, y) => touchMove.set(x, y),
    onLockChange: (fn) => lockListeners.push(fn),
    teleport(x, z, newYaw = 0, newPitch = 0) {
      position.set(x, 0, z);
      velocity.set(0, 0, 0);
      yaw = newYaw;
      pitch = newPitch;
    },
    setEnabled(value) {
      enabled = value;
      if (!value) {
        pressed.clear();
        touchMove.set(0, 0);
      }
    },
    // Devuelve una promesa: el navegador puede negar el bloqueo (p. ej. justo tras pulsar Esc).
    async lock() {
      try {
        await element.requestPointerLock();
        return true;
      } catch {
        return false;
      }
    },
    unlock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    update(dt) {
      let mx = touchMove.x;
      let mz = touchMove.y;
      if (enabled) {
        for (const code of pressed) {
          const dir = KEYS[code];
          if (dir) { mx += dir[0]; mz += dir[1]; }
        }
      }
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }

      const speed = pressed.has('ShiftLeft') || pressed.has('ShiftRight') ? SPRINT : WALK;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const targetX = (mx * cos - mz * sin) * speed;
      const targetZ = (-mx * sin - mz * cos) * speed;
      const ease = 1 - Math.exp(-12 * dt);
      velocity.x += (targetX - velocity.x) * ease;
      velocity.z += (targetZ - velocity.z) * ease;

      if (enabled && onGround && pressed.has('Space')) {
        velocity.y = JUMP;
        onGround = false;
      }
      velocity.y -= GRAVITY * dt;

      position.addScaledVector(velocity, dt);
      if (position.y <= 0) {
        position.y = 0;
        velocity.y = 0;
        onGround = true;
      }
      resolveCollisions(position, PLAYER.radius, colliders);

      const pace = Math.hypot(velocity.x, velocity.z);
      if (onGround) bob += pace * dt * 1.9;
      const sway = onGround ? Math.sin(bob) * 0.035 * Math.min(1, pace / WALK) : 0;
      camera.position.set(position.x, position.y + PLAYER.eye + sway, position.z);
      camera.rotation.set(pitch, yaw, 0);
    },
  };
}
