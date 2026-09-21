// Carta de bienvenida: se rellena desde config.js y avisa cuando ella pulsa "Entrar".
export function createWelcome(letter, onEnter) {
  const root = document.getElementById('welcome');
  document.getElementById('letter-title').textContent = letter.title;
  document.getElementById('letter-signature').textContent = letter.signature;
  const body = document.getElementById('letter-body');
  for (const text of letter.paragraphs) {
    const p = document.createElement('p');
    p.textContent = text;
    body.append(p);
  }

  const button = document.getElementById('enter');
  button.textContent = letter.button;
  button.addEventListener('click', (e) => {
    const touch = e.pointerType ? e.pointerType === 'touch' : matchMedia('(pointer: coarse)').matches;
    root.classList.add('leaving');
    setTimeout(() => (root.hidden = true), 900);
    onEnter({ touch });
  });
}
