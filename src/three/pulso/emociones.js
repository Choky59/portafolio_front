/**
 * Emotions of "El pulso de Hermosillo" and the filter helpers. There's no neutral:
 * everyone who gets to a news feels something (on the way they just have no color yet).
 * Plain JS (no Three.js): used by the 3D scene and by the Vue components.
 * Each emotion's color is the --emo-<clave> CSS token (src/styles/tokens.css).
 */
export const EMOCIONES = [
  { clave: 'alegria', etiqueta: 'Alegría' },
  { clave: 'enojo', etiqueta: 'Enojo' },
  { clave: 'tristeza', etiqueta: 'Tristeza' },
  { clave: 'miedo', etiqueta: 'Miedo' },
  { clave: 'sorpresa', etiqueta: 'Sorpresa' },
]

export const CLAVES_EMOCION = EMOCIONES.map((e) => e.clave)

export const FUENTES = [
  { clave: 'radio', etiqueta: 'Radio', icono: '📻' },
  { clave: 'tv', etiqueta: 'TV', icono: '📺' },
  { clave: 'periodico', etiqueta: 'Periódico', icono: '📰' },
  { clave: 'web', etiqueta: 'Web', icono: '🌐' },
]

export const iconoFuente = (tipo) => FUENTES.find((f) => f.clave === tipo)?.icono ?? '📰'

/** What people say in the speech bubbles, by emotion (on arriving at a news and now and then while there) */
export const FRASES = {
  alegria: [
    '¡ajúa!', 'qué bien', '¡por fin!', 'está chido', 'me late', '¡eso!', '¡bien ahí!', '¡qué padre!',
    'así sí', '¡ya era hora!', '¡arre!', 'me gustó', '¡vamos!', 'eso alegra el día', '¡bravo!', 'qué buena noticia',
  ],
  enojo: [
    '¡no manches!', 'otra vez…', '¡qué coraje!', 'ya estuvo', '¿y luego?', '¡ya basta!', '¡puro cuento!',
    '¿y el gobierno qué?', '¡siempre lo mismo!', '¡qué poca!', 'no se vale', '¡hasta cuándo!', '¡ni modo que no!',
    'pura promesa', '¡qué barbaridad!', '¿quién responde?',
  ],
  tristeza: [
    'qué gacho', 'ni modo', 'qué triste', 'ay no…', 'pobre gente', 'duele leer eso', 'qué pena', 'no puede ser…',
    'se me arrugó', 'qué tristeza', 'pobres familias', 'no era justo', 'uno ya ni sabe', 'qué lástima',
  ],
  miedo: [
    '¡aguas!', 'qué miedo', 'hay que cuidarse', 'ojalá no', '¡cuidado!', 'ya no se puede salir', 'me da nervio',
    '¿y si nos toca?', 'mejor ni salgo', 'qué inseguro', 'Dios nos guarde', 'cierra bien la puerta', 'da escalofrío',
    'hay que estar alertas',
  ],
  sorpresa: [
    '¿neta?', '¡no inventes!', '¿en serio?', 'ah caray', '¡órale!', '¡no me digas!', '¿apoco?', '¡qué cosa!',
    'no me lo esperaba', '¡ándale!', '¿cómo crees?', '¡wow!', 'eso no se ve diario', '¡a poco sí!',
  ],
}

/** What they say when someone cuts through their news, by emotion */
export const FRASES_EMPUJON = {
  alegria: ['¡pásele, pásele!', 'con permisito, ¿eh?', '¡ándale, ve!', 'jaja, ¿perdido?'],
  enojo: ['¡qué grosero!', '¡mira por dónde vas!', '¡fíjate, oye!', '¡ni perdón dijo!'],
  tristeza: ['ni me vio…', 'ay, ni modo', 'todos me empujan…', 'ni un perdón…'],
  miedo: ['¡ay, me asustó!', '¡cuidado!', '¡uy, uy!', '¿y ese quién es?'],
  sorpresa: ['¿y este?', '¡épale!', '¡órale, qué prisa!', '¿a dónde tan rápido?'],
}

/**
 * The news' main emotion: the analysis' own when it comes with one, else the highest
 * share in sentimiento.emociones
 */
export function emocionDominante(noticia) {
  if (CLAVES_EMOCION.includes(noticia?.emocionDominante)) return noticia.emocionDominante
  const emociones = noticia?.sentimiento?.emociones ?? {}
  let mejor = CLAVES_EMOCION[0]
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
 * Draws one emotion following the news' distribution (`random` returns [0, 1)); a news
 * with no mix at all gives its main emotion. Never neutral (shares of other keys are ignored).
 */
export function sortearEmocion(noticia, random = Math.random) {
  const emociones = noticia?.sentimiento?.emociones ?? {}
  const sentidas = CLAVES_EMOCION.filter((c) => (Number(emociones[c]) || 0) > 0)
  if (!sentidas.length) return emocionDominante(noticia)
  const total = sentidas.reduce((s, c) => s + Number(emociones[c]), 0)
  let r = random() * total
  for (const clave of sentidas) {
    r -= Number(emociones[clave])
    if (r <= 0) return clave
  }
  return sentidas[sentidas.length - 1]
}
