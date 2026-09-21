# flowers 🌻

Un campo de girasoles estilo Minecraft para recorrer en primera persona desde el navegador:
un río con peces y un puente, árboles de mango, un jardín de flores y, en medio, una casita
(comedor, cocina y dormitorio) con las fotos en portarretratos sobre las mesitas. En la mesa
del comedor hay un florero de flores amarillas y una cartita que se puede abrir.

## Personalizarlo

- **Fotos**: copia tus imágenes (`.jpg`, `.png`, `.webp`…) en la carpeta `photos/`. Aparecen en
  los portarretratos ordenadas por nombre de archivo (`01.jpg`, `02.jpg`…), empezando por la
  mesita del comedor. Caben 21 en total; solo se sacan los portarretratos necesarios. Conviene
  que no pasen de ~2000 px de lado para que carguen rápido.
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
`fish`, `garden`, `dining`, `table`, `kitchen`, `bedroom`, `frames`, `photo`, `letter`, `out`)
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
| Ver o colocar una foto, leer la cartita | Clic apuntando al objeto | Tocarlo |
| Pausa | Esc | — |
