# flowers 🌻

Un campo de girasoles estilo Minecraft para recorrer en primera persona desde el navegador:
un río con su puente, árboles de mango, papayos y una higuera, un jardín de flores delante
y, en medio, una casita (comedor, cocina y dormitorio) con las fotos en portarretratos sobre
las mesitas. En la mesa del comedor hay un florero de flores amarillas, una canasta de frutas
y una cartita que se puede abrir. La puerta trasera da a un huerto con chiles, tomates,
acelgas, melones y calabacitas. Todo lo que da fruto se puede comer (y vuelve a crecer).
En el dormitorio hay un librero y un proyector con su pantalla, y junto a la casa pasea una
parvada de guajolotes.

## Personalizarlo

- **Fotos**: copia tus imágenes (`.jpg`, `.png`, `.webp`…) en la carpeta `photos/`. Aparecen en
  los portarretratos ordenadas por nombre de archivo (`01.jpg`, `02.jpg`…), empezando por la
  mesita del comedor. Caben 21 en total. Conviene que no pasen de ~2000 px de lado para que
  carguen rápido. La carpeta está en `.gitignore`: las fotos no se suben al repositorio, así
  que el build hay que hacerlo en una máquina que las tenga.
- **Película del proyector**: por defecto pasa las fotos de `photos/` como un pase de cine. Si
  pones un video (`.mp4` o `.webm`) en `videos/`, proyecta ese, con sonido. El título y los
  segundos por foto están en `movie`, en `src/config.js`. `videos/` tampoco se sube al repositorio.
- **Sonido ambiente**: `src/assets/ambience.mp3` suena en bucle desde que se pulsa «Entrar»; se
  oye más bajito dentro de la casita y se silencia con la tecla M o el botón ♪. Para cambiarlo,
  sustituye ese archivo; los volúmenes están al principio de `src/audio/ambience.js`.
- **Carta de bienvenida**, **cartita de la mesa** (`tableLetter`), duración del día y densidad
  de girasoles: `src/config.js`.
- Los portarretratos vacíos (con un `+`) sirven para colocar fotos desde dentro del juego. Esas fotos
  se guardan **solo en el navegador donde se suben**; las que deban verse siempre van en `photos/`.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173 (también accesible desde el móvil en la misma red)
```

En desarrollo se puede saltar la carta para revisar escenas con `?view=` (`field`, `river`,
`garden`, `dining`, `table`, `basket`, `kitchen`, `bedroom`, `frames`, `photo`, `letter`,
`cinema`, `librero`, `backdoor`, `huerto`, `tomato`, `melon`, `papaya`, `fig`, `turkeys`, `out`)
y fijar la hora con `?phase=0…1` (0 amanecer, 0.375 mediodía, 0.75 puesta de sol).

## Publicarlo

```bash
npm run build    # genera dist/
```

`dist/` es un sitio estático con rutas relativas: basta copiarlo al servidor, en la raíz o en
cualquier subcarpeta (por ejemplo `rsync -av dist/ usuario@servidor:/var/www/girasoles/`).
Tras añadir o cambiar fotos hay que volver a ejecutar el build.

## Controles

| | Ordenador | Móvil |
|---|---|---|
| Caminar | WASD / flechas (Mayús para correr, Espacio para saltar) | Joystick en la mitad izquierda |
| Mirar | Ratón | Arrastrar el dedo |
| Ver o colocar una foto, leer la cartita, comer un fruto, encender el proyector, saludar a un guajolote | Clic apuntando al objeto | Tocarlo |
| Silenciar el sonido | M (o el botón ♪) | Botón ♪ |
| Pausa | Esc | — |
