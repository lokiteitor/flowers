import * as THREE from 'three';
import { getTextures } from '../world/textures.js';
import { addPhoto, listPhotos, removePhoto, shrinkImage } from './storage.js';

// Todo lo que haya en /photos entra en la galería, ordenado por nombre de archivo.
const presetFiles = import.meta.glob('/photos/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
});
export const presetUrls = Object.keys(presetFiles)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((key) => presetFiles[key]);

const BORDER = 0.06; // ancho del marco alrededor de la foto
const MAX_SIDE = 0.8; // lado mayor de la foto, en bloques
const EMPTY_SIDE = 0.6;
const TILT = -0.2; // los portarretratos se recuestan un poco hacia atrás
const FRAME_STYLES = [{ wood: true }, { color: 0xf2ead8 }, { color: 0xd9a441 }];

// `slots` son los sitios sobre las mesitas de la casa: { x, y, z, facing }.
export async function createGallery(scene, { slots, maxTextureSize, maxAnisotropy }) {
  const tex = getTextures();
  const root = new THREE.Group();
  scene.add(root);

  const emptyMaterial = new THREE.MeshBasicMaterial({ map: tex.emptyFrame });
  const textureCache = new Map(); // url → Promise<{ texture, aspect }>

  const presets = presetUrls.map((url) => ({ url, uploaded: false }));
  const uploads = (await listPhotos()).map((record) => ({
    id: record.id, slot: record.slot, url: URL.createObjectURL(record.blob), uploaded: true,
  }));

  let frames = [];
  let hovered = null;

  // Las fotos grandes se reducen antes de subirlas a la GPU; la original se ve en el visor.
  function loadTexture(url) {
    if (!textureCache.has(url)) {
      textureCache.set(url, new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxTextureSize / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = maxAnisotropy;
          resolve({ texture, aspect: canvas.width / canvas.height });
        };
        img.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
        img.src = url;
      }));
    }
    return textureCache.get(url);
  }

  // Portarretratos de pie sobre la mesita: marco, foto (o el «+» si está vacío) y pata trasera.
  function assemble(frame, slot, width, height, pictureMaterial) {
    const group = new THREE.Group();
    group.position.set(slot.x, slot.y, slot.z);
    group.rotation.y = slot.facing;
    const leaning = new THREE.Group();
    leaning.rotation.x = TILT;
    group.add(leaning);

    const style = FRAME_STYLES[frame.index % FRAME_STYLES.length];
    const material = new THREE.MeshLambertMaterial(style.wood ? { map: tex.frameWood } : { color: style.color });
    const outerH = height + BORDER * 2;
    const backing = new THREE.Mesh(new THREE.BoxGeometry(width + BORDER * 2, outerH, 0.05), material);
    backing.position.y = outerH / 2;
    backing.userData.frame = frame;
    leaning.add(backing);

    const picture = new THREE.Mesh(new THREE.PlaneGeometry(width, height), pictureMaterial);
    picture.position.set(0, outerH / 2, 0.027);
    leaning.add(picture);

    // Pata trasera: del dorso del marco (a 2/3 de altura) a la mesa, por detrás.
    const topY = outerH * 0.66 * Math.cos(TILT);
    const topZ = outerH * 0.66 * Math.sin(TILT) - 0.04;
    const footZ = topZ - 0.22;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, Math.hypot(topY, topZ - footZ), 0.03), material);
    strut.position.set(0, topY / 2, (topZ + footZ) / 2);
    strut.rotation.x = Math.atan2(topZ - footZ, topY);
    group.add(strut);

    frame.backing = backing;
    root.add(group);
  }

  function buildFrame(slot, index, photo) {
    const frame = { index, photo, backing: null };
    if (!photo) {
      assemble(frame, slot, EMPTY_SIDE, EMPTY_SIDE, emptyMaterial);
      return frame;
    }
    // El marco se hace a la medida de la foto, así que espera a conocer su proporción.
    loadTexture(photo.url).then(({ texture, aspect }) => {
      if (!frames.includes(frame)) return; // la galería se recolocó mientras cargaba
      const width = aspect >= 1 ? MAX_SIDE : MAX_SIDE * aspect;
      assemble(frame, slot, width, width / aspect, new THREE.MeshBasicMaterial({ map: texture }));
    }).catch((error) => console.warn(error.message));
    return frame;
  }

  function layout() {
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      if (node.material !== emptyMaterial) node.material.dispose();
    });
    root.clear();
    hovered = null;
    // Todas las mesitas llevan sus portarretratos; los que no tienen foto muestran el «+».
    const shown = slots;
    if (presets.length > shown.length) {
      console.warn(`Hay ${presets.length} fotos y solo caben ${shown.length}; las últimas no se muestran.`);
    }

    const assigned = new Array(shown.length).fill(null);
    presets.slice(0, shown.length).forEach((photo, i) => (assigned[i] = photo));
    // Cada foto subida vuelve al marco donde se colocó, si sigue libre.
    const homeless = [];
    for (const photo of uploads) {
      const home = Number.isInteger(photo.slot) && photo.slot < shown.length && !assigned[photo.slot];
      if (home) assigned[photo.slot] = photo;
      else homeless.push(photo);
    }
    for (const photo of homeless) {
      const free = assigned.indexOf(null);
      if (free >= 0) assigned[free] = photo;
    }

    frames = shown.map((slot, i) => buildFrame(slot, i, assigned[i]));
  }

  layout();

  return {
    get targets() {
      return frames.filter((f) => f.backing).map((f) => f.backing);
    },
    get hasFreeFrame() {
      return frames.some((f) => !f.photo);
    },
    setHovered(frame) {
      if (frame === hovered) return;
      if (hovered) hovered.backing.material.emissive.setHex(0x000000);
      hovered = frame;
      if (hovered) hovered.backing.material.emissive.setHex(0x4a3414);
    },
    async upload(file, slotIndex) {
      const blob = await shrinkImage(file);
      const record = await addPhoto(blob, slotIndex);
      uploads.push({ id: record.id, slot: slotIndex, url: URL.createObjectURL(blob), uploaded: true });
      layout();
    },
    async remove(photo) {
      const index = uploads.indexOf(photo);
      if (index < 0) return;
      uploads.splice(index, 1);
      await removePhoto(photo.id);
      textureCache.get(photo.url)?.then(({ texture }) => texture.dispose()).catch(() => {});
      textureCache.delete(photo.url);
      URL.revokeObjectURL(photo.url);
      layout();
    },
  };
}
