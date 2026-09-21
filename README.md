# flowers 🌻

Un campo de girasoles estilo Minecraft, con árboles de mango y una casita en medio cuyas
paredes son una galería de fotos. Se recorre en primera persona desde el navegador.

## Personalizarlo

- **Fotos**: copia tus imágenes (`.jpg`, `.png`, `.webp`…) en la carpeta `photos/`. Aparecen en
  los cuadros ordenadas por nombre de archivo (`01.jpg`, `02.jpg`…). Caben 11 en una fila; con
  más, la galería pasa sola a dos filas (hasta 22). Conviene que no pasen de ~2000 px de lado
  para que carguen rápido.
- **Carta de bienvenida**, duración del día, densidad de girasoles: `src/config.js`.
- Los marcos vacíos (con un `+`) sirven para colocar fotos desde dentro del juego. Esas fotos
  se guardan **solo en el navegador donde se suben**; las que deban verse siempre van en `photos/`.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173 (también accesible desde el móvil en la misma red)
```

En desarrollo se puede saltar la carta para revisar escenas: `?view=field|inside|left|right|out`
y `?phase=0…1` para fijar la hora (0 amanecer, 0.375 mediodía, 0.75 puesta de sol).

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
| Ver o colocar una foto | Clic apuntando al cuadro | Tocar el cuadro |
| Pausa | Esc | — |
