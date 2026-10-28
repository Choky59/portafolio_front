/**
 * How each emotion moves and what it gives off, in one place. Plain data: the crowd
 * (multitud.js) reads `cuerpo`, the particles (particulas.js) read `particulas`, and
 * the simulation gets `apretar` (simulacion.js). Colors are not here: they're the
 * --emo-<clave> tokens (src/styles/tokens.css).
 *
 * Units: distances in world units (a person is ~1.2 tall), times in seconds.
 * `cada: [min, max]` is drawn per person inside that range, so nobody is in sync.
 * Everything fades in with the emotion's color and only plays while the person is
 * standing at its news (people on the move just walk or run).
 *
 * cuerpo:
 *   temblor:     { amplitud, velocidad }        side to side shake (velocidad in rad/s)
 *   pulso:       { cada, color }                the color gets darker in beats (0–1)
 *   brinco:      { altura, cada, aplastar }     hops with squash & stretch (0–1)
 *   susto:       { cada, salto, atras }         a quick start: up and back
 *   cabizbajo:   radians                        head bowed forward
 *   respiracion: { cada, cuanto }               slow vertical breathing (0–1 of height)
 *   apretar:     0–1                            pulls them toward the center of their news
 *
 * particulas: [{ tipo, cada, dura, ...behavior }]
 *   tipo:        one of the textures in lapiz.js (texturaParticula) or a list to pick from
 *   porGrupo:    one timer per news instead of per person (confetti over the circle)
 *   cuantas:     pieces per burst (porGrupo)
 *   soloAlgunos: 0–1 share of the people that ever show it
 */
export const ANIMACIONES = {
  enojo: {
    cuerpo: {
      // No shake: it drew too much attention
      pulso: { cada: 1.4, color: 0.3 },
    },
    particulas: [
      { tipo: 'vena', cada: [2.5, 5], dura: 1.4 },
      { tipo: 'vapor', cada: [5, 10], dura: 1.8 },
    ],
  },
  alegria: {
    cuerpo: {
      brinco: { altura: 0.32, cada: [0.65, 1.05], aplastar: 0.28 },
    },
    particulas: [
      { tipo: 'confeti', porGrupo: true, cada: [3.5, 7], cuantas: 10 },
      { tipo: ['destello', 'nota'], cada: [4, 9], dura: 1.8 },
    ],
  },
  sorpresa: {
    cuerpo: {
      susto: { cada: [2.5, 5], salto: 0.2, atras: 0.16 },
    },
    particulas: [{ tipo: ['exclamacion', 'interrogacion'], cada: [3, 6], dura: 1.2 }],
  },
  miedo: {
    cuerpo: {
      temblor: { amplitud: 0.03, velocidad: 24 },
      susto: { cada: [4, 9], salto: 0.16, atras: 0 },
      apretar: 0.4,
    },
    particulas: [{ tipo: 'sudor', cada: [2.5, 5], dura: 1.4 }],
  },
  tristeza: {
    cuerpo: {
      cabizbajo: 0.4,
      respiracion: { cada: 4.5, cuanto: 0.05 },
    },
    particulas: [
      { tipo: 'lagrima', cada: [1.8, 4], dura: 1.2 },
      { tipo: 'nube', soloAlgunos: 0.2, cada: [5, 9], dura: 4.5 },
    ],
  },
  neutral: {
    cuerpo: {
      respiracion: { cada: 3.5, cuanto: 0.025 },
    },
    particulas: [],
  },
}

/** Everyone blinks (they all have eyes) */
export const PARPADEO = { cada: [2.5, 6], dura: 0.13 }

/** Live particles of each type at most: past this, new ones are skipped */
export const LIMITES = { porTipo: 40 }

/**
 * Particles are drawn bigger when the camera is far, so they stay readable at the
 * default view: `distancia / AUMENTO_CADA` times, at least 1 and at most AUMENTO_MAX.
 */
export const AUMENTO_CADA = 26
export const AUMENTO_MAX = 3
