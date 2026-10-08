/**
 * Emotions of "El pulso de Hermosillo" and the filter helpers.
 * Plain JS (no Three.js): used by the 3D scene and by the Vue components.
 * Each emotion's color is the --emo-<clave> CSS token (src/styles/tokens.css).
 */
export const EMOCIONES = [
  { clave: 'alegria', etiqueta: 'Alegría' },
  { clave: 'enojo', etiqueta: 'Enojo' },
  { clave: 'tristeza', etiqueta: 'Tristeza' },
  { clave: 'miedo', etiqueta: 'Miedo' },
  { clave: 'sorpresa', etiqueta: 'Sorpresa' },
  { clave: 'neutral', etiqueta: 'Neutral' },
]

export const CLAVES_EMOCION = EMOCIONES.map((e) => e.clave)

export const FUENTES = [
  { clave: 'radio', etiqueta: 'Radio', icono: '📻' },
  { clave: 'tv', etiqueta: 'TV', icono: '📺' },
  { clave: 'periodico', etiqueta: 'Periódico', icono: '📰' },
  { clave: 'web', etiqueta: 'Web', icono: '🌐' },
]

export const iconoFuente = (tipo) => FUENTES.find((f) => f.clave === tipo)?.icono ?? '📰'

/** What people say in the speech bubbles, by emotion */
export const FRASES = {
  alegria: ['¡ajúa!', 'qué bien', '¡por fin!', 'está chido', 'me late', '¡eso!'],
  enojo: ['¡no manches!', 'otra vez…', '¡qué coraje!', 'ya estuvo', '¿y luego?'],
  tristeza: ['qué gacho', 'ni modo', 'qué triste', 'ay no…'],
  miedo: ['¡aguas!', 'qué miedo', 'hay que cuidarse', 'ojalá no'],
  sorpresa: ['¿neta?', '¡no inventes!', '¿en serio?', 'ah caray', '¡órale!'],
  neutral: ['ok', 'ah, ok', 'mmm', 'sale', 'a ver'],
}

/** What the ones who hear the user's shout answer */
export const GRITOS = ['¡a ver, a ver!', '¿qué pasó?', '¡vamos!', '¡voy!', '¿dónde?', '¡espérenme!']

/** Emotion with the highest share in sentimiento.emociones */
export function emocionDominante(noticia) {
  const emociones = noticia?.sentimiento?.emociones ?? {}
  let mejor = 'neutral'
  let max = -1
  for (const clave of CLAVES_EMOCION) {
    const valor = emociones[clave] ?? 0
    if (valor > max) {
      max = valor
      mejor = clave
    }
  }
  return mejor
}

/**
 * filtro = { emocion, fuente, categoria }; an empty value means "all".
 * Same fields the news API will filter by.
 */
export function pasaFiltro(noticia, filtro = {}) {
  if (filtro.emocion && emocionDominante(noticia) !== filtro.emocion) return false
  if (filtro.fuente && noticia.fuente?.tipo !== filtro.fuente) return false
  if (filtro.categoria && noticia.categoria !== filtro.categoria) return false
  return true
}

/**
 * Draws one emotion following the news' distribution (`random` returns [0, 1)).
 * `sinNeutral`: leaves neutral out, so someone always *feels* something, unless
 * the news has no other emotion at all.
 */
export function sortearEmocion(noticia, random = Math.random, { sinNeutral = false } = {}) {
  const emociones = noticia?.sentimiento?.emociones ?? {}
  let claves = CLAVES_EMOCION
  if (sinNeutral) {
    const sentidas = CLAVES_EMOCION.filter((c) => c !== 'neutral' && (emociones[c] ?? 0) > 0)
    if (sentidas.length) claves = sentidas
  }
  const total = claves.reduce((s, c) => s + (emociones[c] ?? 0), 0) || 1
  let r = random() * total
  for (const clave of claves) {
    r -= emociones[clave] ?? 0
    if (r <= 0) return clave
  }
  return 'neutral'
}
