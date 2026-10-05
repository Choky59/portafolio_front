import { api } from './client'

/** { temperatura, humedad, estado, medidoEn, enLinea } */
export async function getEstado(signal) {
  return api('/se-puede-salir/estado', { signal })
}

/** { horas, intervaloMinutos, puntos: [{ medidoEn, temperatura, humedad }] } */
export async function getHistorial(horas = 24, signal) {
  return api(`/se-puede-salir/historial?horas=${horas}`, { signal })
}
