// La cartita de la mesa, abierta: mismo pergamino que la carta de bienvenida.
export function createNote(letter, { onClose }) {
  const root = document.getElementById('note');
  document.getElementById('note-title').textContent = letter.title;
  document.getElementById('note-signature').textContent = letter.signature;
  const body = document.getElementById('note-body');
  for (const text of letter.paragraphs) {
    const p = document.createElement('p');
    p.textContent = text;
    body.append(p);
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    onClose();
  }

  document.getElementById('note-close').addEventListener('click', close);
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'Enter') close();
  });

  return { open: () => (root.hidden = false) };
}
