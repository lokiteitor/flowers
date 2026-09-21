// Todo lo personalizable del regalo está aquí.
export const config = {
  // Carta de bienvenida
  letter: {
    title: 'Para ti, mi vida.',
    paragraphs: [
      'Sembré este campo de girasoles para ti.',
      'En medio hay una casita con nuestros recuerdos. Camina hasta ella, entra y míralos con calma.',
      'Los marcos vacíos son para las fotos que aún nos faltan.',
      'Vamos con el padre de una vez.',
    ],
    signature: 'Te quiero bonita :D',
    button: 'Entrar',
  },

  // La cartita que hay sobre la mesa del comedor, junto al florero: se abre al hacer clic.
  tableLetter: {
    title: 'Mi girasol',
    paragraphs: [
      'Estas flores amarillas son para ti, como todas las de ahí fuera.',
      'Gracias por cada uno de los recuerdos que hay en esta casita. Quiero llenar contigo todos los marcos que quedan.',
      'Quiero algun dia construir esta casita y cuidar juntos los guajolotes cuando se hagan realidad.'
    ],
    signature: 'Te quiero',
  },

  // Cine del dormitorio. Pasa las fotos de photos/ como una película; si hay un video en
  // videos/ (mp4 o webm), proyecta ese en su lugar.
  movie: { title: 'Nuestras pato aventuras', secondsPerPhoto: 5 },

  // Duración de un ciclo completo día → atardecer → noche → amanecer, en segundos.
  dayCycleSeconds: 900,
  // Momento inicial del ciclo (0 = amanecer, 0.375 = mediodía, 0.75 = puesta de sol).
  // 0.68 es la hora dorada: lo primero que se ve es el campo al atardecer.
  startPhase: 0.68,

  // Separación entre girasoles, en bloques (menos = campo más denso y más carga gráfica).
  flowerSpacing: 1.25,
  flowerSpacingMobile: 1.7,
};
