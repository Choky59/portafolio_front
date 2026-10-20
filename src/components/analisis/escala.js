import { config } from '../../config'

/* Same thresholds as the backend (portafolio_back/src/constants/sePuedeSalir.ts, UMBRALES) */
export const BANDAS_ESTADO = [
  { clave: 'frio', desde: -Infinity, hasta: 20, color: 'var(--frio)' },
  { clave: 'ideal', desde: 20, hasta: 30, color: 'var(--ideal)' },
  { clave: 'calor', desde: 30, hasta: 35, color: 'var(--calor)' },
  { clave: 'extremo', desde: 35, hasta: Infinity, color: 'var(--extremo)' },
]

export const colorEstado = (clave) => BANDAS_ESTADO.find((b) => b.clave === clave)?.color ?? 'var(--muted)'

/** Vertical range that follows the data (at least `alturaMinima` °C tall), on round ticks */
export function rangoTemperatura(valores, alturaMinima = 8) {
  let min = valores.length ? Math.min(...valores) - 1 : 15
  let max = valores.length ? Math.max(...valores) + 1 : 40
  if (max - min < alturaMinima) {
    const centro = (max + min) / 2
    min = centro - alturaMinima / 2
    max = centro + alturaMinima / 2
  }
  const paso = max - min <= 14 ? 2 : 5
  min = Math.floor(min / paso) * paso
  max = Math.ceil(max / paso) * paso
  const ticks = []
  for (let v = min; v <= max; v += paso) ticks.push(v)
  return { min, max, paso, ticks }
}

/** State bands clipped to [min, max], as rects for an SVG with y(v) */
export function bandasEnRango(min, max, y) {
  return BANDAS_ESTADO.filter((b) => b.hasta > min && b.desde < max).map((b) => {
    const arriba = y(Math.min(b.hasta, max))
    const abajo = y(Math.max(b.desde, min))
    return { ...b, y: arriba, alto: abajo - arriba }
  })
}

/* ---------------------------------- Formatting ---------------------------------- */

// Day keys are "yyyy-mm-dd" strings (already in Hermosillo time): format them as UTC noon
const aFecha = (fecha) => new Date(`${fecha}T12:00:00Z`)

const fmtCorta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtLarga = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const fmtMes = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const fmtMomento = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: config.zonaHoraria,
})

export const fechaCorta = (fecha) => fmtCorta.format(aFecha(fecha))
export const fechaLarga = (fecha) => fmtLarga.format(aFecha(fecha))
export const nombreMes = (fecha) => fmtMes.format(aFecha(fecha))
export const momento = (iso) => fmtMomento.format(new Date(iso))
export const grados = (v) => `${Number(v).toFixed(1)} °C`
