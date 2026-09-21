import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el build funciona en la raíz del servidor o en cualquier subcarpeta.
  base: './',
  server: {
    // Accesible desde el móvil en la misma red para probar los controles táctiles.
    host: true,
  },
});
