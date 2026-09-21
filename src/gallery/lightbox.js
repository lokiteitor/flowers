// Vista ampliada de una foto, en HTML por encima del juego.
export function createLightbox({ onClose, onRemove }) {
  const root = document.getElementById('lightbox');
  const image = document.getElementById('lightbox-image');
  const removeButton = document.getElementById('lightbox-remove');
  const closeButton = document.getElementById('lightbox-close');
  let current = null;

  function close() {
    if (!current) return;
    current = null;
    root.hidden = true;
    image.removeAttribute('src');
    onClose();
  }

  closeButton.addEventListener('click', close);
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  removeButton.addEventListener('click', () => {
    const photo = current;
    close();
    onRemove(photo);
  });
  document.addEventListener('keydown', (e) => {
    if (current && (e.code === 'Escape' || e.code === 'Enter')) close();
  });

  return {
    get isOpen() {
      return current !== null;
    },
    open(photo) {
      current = photo;
      image.src = photo.url;
      removeButton.hidden = !photo.uploaded;
      root.hidden = false;
    },
  };
}
