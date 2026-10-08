/**
 * Reads the brand colors from the CSS variables (src/styles/tokens.css),
 * so 3D scenes follow the light/dark theme without hardcoding colors.
 */
const VARIABLES = {
  bg: '--bg',
  surface: '--surface',
  text: '--text',
  accent: '--accent',
  frio: '--frio',
  ideal: '--ideal',
  calor: '--calor',
  extremo: '--extremo',
  suelo: '--three-suelo',
  montana: '--three-montana',
  saguaro: '--three-saguaro',
  vidrio: '--three-vidrio',
  alegria: '--emo-alegria',
  enojo: '--emo-enojo',
  tristeza: '--emo-tristeza',
  miedo: '--emo-miedo',
  sorpresa: '--emo-sorpresa',
  neutral: '--emo-neutral',
}

export function leerPaleta() {
  const estilos = getComputedStyle(document.documentElement)
  const paleta = {}
  for (const [clave, variable] of Object.entries(VARIABLES)) {
    paleta[clave] = estilos.getPropertyValue(variable).trim() || '#ffffff'
  }
  return paleta
}

/** Same thresholds as the backend (src/constants/sePuedeSalir.ts) */
export function colorPorTemperatura(temperatura, paleta) {
  if (temperatura < 20) return paleta.frio
  if (temperatura < 30) return paleta.ideal
  if (temperatura <= 35) return paleta.calor
  return paleta.extremo
}
