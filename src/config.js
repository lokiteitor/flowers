// Todo lo personalizable del regalo está aquí.
export const config = {
  // Carta de bienvenida
  letter: {
    title: 'Para ti, mi amor',
    paragraphs: [
      'Sembré este campo de girasoles para ti.',
      'En medio hay una casita con nuestros recuerdos. Camina hasta ella, entra y míralos con calma.',
      'Los marcos vacíos son para las fotos que aún nos faltan.',
    ],
    signature: 'Con todo mi cariño',
    button: 'Entrar',
  },

  // La cartita que hay sobre la mesa del comedor, junto al florero: se abre al hacer clic.
  tableLetter: {
    title: 'Mi girasol',
    paragraphs: [
      'Estas flores amarillas son para ti, como todas las de ahí fuera.',
      'Gracias por cada uno de los recuerdos que hay en esta casita. Quiero llenar contigo todos los marcos que quedan.',
    ],
    signature: 'Te quiero',
  },

  // Duración de un ciclo completo día → atardecer → noche → amanecer, en segundos.
  dayCycleSeconds: 300,
  // Momento inicial del ciclo (0 = amanecer, 0.375 = mediodía, 0.75 = puesta de sol).
  // 0.68 es la hora dorada: lo primero que se ve es el campo al atardecer.
  startPhase: 0.68,

  // Separación entre girasoles, en bloques (menos = campo más denso y más carga gráfica).
  flowerSpacing: 1.25,
  flowerSpacingMobile: 1.7,

  // Marcos vacíos que siempre se dejan libres para subir fotos desde el juego.
  spareFrames: 2,
};
