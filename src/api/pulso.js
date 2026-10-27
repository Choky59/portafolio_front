import { api } from './client'

/** Query string from an object, without empty values */
const qs = (params = {}) => {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  const s = p.toString()
  return s ? `?${s}` : ''
}

/** { totales, emociones, temas, ambitos, tipos, tonos, dias, etiquetas } */
export const getResumen = (signal) => api('/pulso/resumen', { signal })

/** { total, pagina, porPagina, notas } with filters: tema, subtema, emocion, fuente, ambito, tipo, actor, q, desde, hasta, pagina */
export const getNotas = (filtros, signal) => api(`/pulso/notas${qs(filtros)}`, { signal })

/** { nota } one analyzed note with its event, in the same shape as getNotas' notes */
export const getNota = (id, signal) => api(`/pulso/notas/${encodeURIComponent(id)}`, { signal })

/** { medios: [{ fuente, nombre, notas, temas, emociones, tonos, polaridad, postura }] } */
export const getMedios = (signal) => api('/pulso/medios', { signal })

/** { actores: [{ nombre, tipo, cargo, menciones, tono, roles, temas, medios }] } */
export const getActores = (signal, limite = 30) => api(`/pulso/actores${qs({ limite })}`, { signal })

/** { fuentes: [{ slug, nombre }] } (sources with notes, for the filters) */
export const getFuentes = (signal) => api('/pulso/fuentes', { signal })

/** GeoJSON FeatureCollection of the places of the news (same filters as getNotas) */
export const getMapa = (filtros, signal) => api(`/pulso/mapa${qs(filtros)}`, { signal })

/** { colonias: [{ colonia, notas, emociones, polaridad, punto }] } */
export const getMapaColonias = (filtros, signal) => api(`/pulso/mapa/colonias${qs(filtros)}`, { signal })

/** { noticias } latest notes in the crowd visualization's shape; `saltar` skips the newest ones (older pages) */
export const getMultitud = (signal, limite = 40, saltar = 0) => api(`/pulso/multitud${qs({ limite, saltar })}`, { signal })

/* ---------- ADMIN: analysis jobs (the LLM costs money, so it only runs when asked) ---------- */

/** { capturas, resumen } of what a range would analyze, with the estimated cost */
export const getPendientes = ({ desde, hasta, fuentes = [] }, signal) =>
  api(`/pulso/admin/pendientes${qs({ desde, hasta, fuentes: fuentes.join(',') })}`, { auth: true, signal })

/** { trabajos, consumo } */
export const getTrabajos = (signal) => api('/pulso/admin/trabajos', { auth: true, signal })

/** { trabajo } — body: { desde, hasta, fuentes, ids?, presupuestoUSD } */
export const crearTrabajo = (datos) => api('/pulso/admin/trabajos', { method: 'POST', auth: true, body: datos })

export const cancelarTrabajo = (id) => api(`/pulso/admin/trabajos/${id}/cancelar`, { method: 'POST', auth: true })

/* ---------- ADMIN: deleting analyses (to analyze a range again with the current prompt) ---------- */

/** { todo, capturas, notas, eventosAfectados, eventosQueSeBorran, trabajoActivo } — nothing is touched */
export const getBorrado = ({ desde, hasta, fuentes = [] }, signal) =>
  api(`/pulso/admin/borrado${qs({ desde, hasta, fuentes: fuentes.join(',') })}`, { auth: true, signal })

/** { capturas, notas, eventos } — body: { desde, hasta, fuentes, confirmacion: 'BORRAR' } */
export const borrarAnalisis = (datos) => api('/pulso/admin/borrado', { method: 'POST', auth: true, body: datos })
