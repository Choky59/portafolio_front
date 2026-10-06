import { inject, watchEffect } from 'vue'
import { setHead } from './useHead'

/** Key used by ProyectoLayout to share the loaded project with its tabs */
export const PROYECTO_KEY = Symbol('proyecto')

/**
 * Inside a project tab: { proyecto, anterior, siguiente } (computed refs).
 * The layout only renders the tabs once the project is loaded, so proyecto.value is always set.
 */
export function useProyecto() {
  return inject(PROYECTO_KEY)
}

/**
 * <title> and meta description of a project tab, e.g. "Videos · ¿Se puede salir? · Jorge García".
 * `seccion` is null for the Resumen tab. `fn` may return overrides (a single video page).
 */
export function useHeadSeccion(seccion, fn = () => ({})) {
  const { proyecto } = useProyecto()
  watchEffect(() => {
    const p = proyecto.value
    if (!p) return
    const extra = fn(p) ?? {}
    const nombre = extra.nombre ?? seccion
    setHead({
      title: nombre ? `${nombre} · ${p.titulo} · Jorge García` : `#${p.numero} ${p.titulo} · Jorge García`,
      description: extra.descripcion ?? p.resumen,
    })
  })
}

/**
 * Tabs of a project page. Tabs without content are hidden.
 * `rutas` are the route names that mark the tab as active.
 */
export function pestanasDe(proyecto) {
  const p = proyecto ?? {}
  return [
    { nombre: 'Resumen', ruta: 'proyecto', rutas: ['proyecto'], visible: true },
    {
      nombre: 'Videos',
      ruta: 'proyecto-videos',
      rutas: ['proyecto-videos', 'proyecto-video'],
      visible: !!(p.videos?.length || p.escenas?.length),
    },
    {
      nombre: 'Cómo funciona',
      ruta: 'proyecto-como-funciona',
      rutas: ['proyecto-como-funciona'],
      visible: !!(p.comoFunciona?.length || p.modelo3d),
    },
    {
      nombre: 'Materiales',
      ruta: 'proyecto-materiales',
      rutas: ['proyecto-materiales'],
      visible: !!(p.materiales?.length || p.pasos?.length),
    },
    {
      nombre: 'Código',
      ruta: 'proyecto-codigo',
      rutas: ['proyecto-codigo'],
      visible: !!(p.codigo?.length || p.descargas?.length),
    },
  ].filter((t) => t.visible)
}
