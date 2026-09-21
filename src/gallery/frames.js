import * as THREE from 'three';
import { getTextures } from '../world/textures.js';
import { frameSlots } from '../world/house.js';
import { addPhoto, listPhotos, removePhoto, shrinkImage } from './storage.js';

// Todo lo que haya en /photos entra en la galería, ordenado por nombre de archivo.
const presetFiles = import.meta.glob('/photos/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const presetUrls = Object.keys(presetFiles)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((key) => presetFiles[key]);

const SINGLE_ROW_CAPACITY = frameSlots(1).length;
const BORDER = 0.12;
const MARGIN = 0.07;

export async function createGallery(scene, { spareFrames, maxTextureSize, maxAnisotropy }) {
  const tex = getTextures();
  const root = new THREE.Group();
  scene.add(root);

  const matBoard = new THREE.MeshLambertMaterial({ color: 0xe9dcc0 });
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

  function buildFrame(slot, index, photo) {
    const group = new THREE.Group();
    group.position.set(slot.x, slot.y, slot.z);
    group.rotation.y = slot.facing;

    const wood = new THREE.MeshLambertMaterial({ map: tex.frameWood });
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(slot.width + BORDER * 2, slot.height + BORDER * 2, 0.1),
      wood,
    );
    const frame = { index, photo, backing };
    backing.userData.frame = frame;
    group.add(backing);

    const inner = new THREE.Mesh(
      new THREE.PlaneGeometry(slot.width, slot.height),
      photo ? matBoard : emptyMaterial,
    );
    inner.position.z = 0.051;
    group.add(inner);

    if (photo) {
      loadTexture(photo.url).then(({ texture, aspect }) => {
        if (!frames.includes(frame)) return; // la galería se recolocó mientras cargaba
        const maxW = slot.width - MARGIN * 2;
        const maxH = slot.height - MARGIN * 2;
        const width = Math.min(maxW, maxH * aspect);
        const picture = new THREE.Mesh(
          new THREE.PlaneGeometry(width, width / aspect),
          new THREE.MeshBasicMaterial({ map: texture }),
        );
        picture.position.z = 0.056;
        group.add(picture);
      }).catch((error) => console.warn(error.message));
    }

    root.add(group);
    return frame;
  }

  function layout() {
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      if (node.material !== matBoard && node.material !== emptyMaterial) node.material.dispose();
    });
    root.clear();
    hovered = null;
    const wanted = presets.length + uploads.length + spareFrames;
    const slots = frameSlots(wanted > SINGLE_ROW_CAPACITY ? 2 : 1);
    if (presets.length > slots.length) {
      console.warn(`Hay ${presets.length} fotos y solo caben ${slots.length}; las últimas no se muestran.`);
    }

    const assigned = new Array(slots.length).fill(null);
    presets.slice(0, slots.length).forEach((photo, i) => (assigned[i] = photo));
    // Cada foto subida vuelve al marco donde se colocó, si sigue libre.
    const homeless = [];
    for (const photo of uploads) {
      const home = Number.isInteger(photo.slot) && photo.slot < slots.length && !assigned[photo.slot];
      if (home) assigned[photo.slot] = photo;
      else homeless.push(photo);
    }
    for (const photo of homeless) {
      const free = assigned.indexOf(null);
      if (free >= 0) assigned[free] = photo;
    }

    frames = slots.map((slot, i) => buildFrame(slot, i, assigned[i]));
  }

  layout();

  return {
    get targets() {
      return frames.map((f) => f.backing);
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
