import { api } from './client'

/** { temperatura, humedad, estado, medidoEn, enLinea } */
export async function getEstado(signal) {
  return api('/se-puede-salir/estado', { signal })
}

/** { horas, intervaloMinutos, puntos: [{ medidoEn, temperatura, min, max, humedad }] } */
export async function getHistorial(horas = 24, signal) {
  return api(`/se-puede-salir/historial?horas=${horas}`, { signal })
}

/**
 * Last `dias` days: { desde, hasta, totalLecturas, franjas, dias: [{ fecha, min, max, promedio, estado,
 * franjas: { manana, tarde, noche } }], diaTipico, estados, records, bateria }
 */
export async function getAnalisis(dias = 90, signal) {
  return api(`/se-puede-salir/analisis?dias=${dias}`, { signal })
}

/** One calendar day (06:00 → 05:59): { fecha, desde, hasta, intervaloMinutos, puntos: [{ medidoEn, temperatura, min, max, humedad }] } */
export async function getDia(fecha, signal) {
  return api(`/se-puede-salir/dia?fecha=${encodeURIComponent(fecha)}`, { signal })
}
