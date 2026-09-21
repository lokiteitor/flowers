// Fotos subidas desde el juego: se guardan en IndexedDB, es decir, solo en este navegador.
const DB_NAME = 'flowers-gallery';
const STORE = 'photos';
const MAX_SIDE = 1600;

let dbPromise;
// Si IndexedDB no está disponible (modo privado, etc.), las fotos duran lo que la sesión.
const memory = [];
let memoryId = 1;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function run(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

// Reduce la foto antes de guardarla: las del móvil pesan demasiado para una textura.
export async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.9),
  );
}

export async function listPhotos() {
  try {
    return await run('readonly', (store) => store.getAll());
  } catch {
    return [...memory];
  }
}

export async function addPhoto(blob, slot) {
  const record = { blob, slot, addedAt: Date.now() };
  try {
    const id = await run('readwrite', (store) => store.add(record));
    return { ...record, id };
  } catch {
    const saved = { ...record, id: `m${memoryId++}` };
    memory.push(saved);
    return saved;
  }
}

export async function removePhoto(id) {
  const index = memory.findIndex((p) => p.id === id);
  if (index >= 0) {
    memory.splice(index, 1);
    return;
  }
  try {
    await run('readwrite', (store) => store.delete(id));
  } catch {
    // Nada que borrar si la base de datos no está disponible.
  }
}
