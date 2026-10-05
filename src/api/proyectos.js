import { api } from './client'

export async function listProyectos(signal) {
  const res = await api('/proyectos', { signal })
  return res.proyectos
}

/** { proyecto, anterior, siguiente } */
export async function getProyecto(slug, signal) {
  return api(`/proyectos/${encodeURIComponent(slug)}`, { signal })
}
