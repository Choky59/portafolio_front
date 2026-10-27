import { defineAsyncComponent } from 'vue'

/**
 * Data analysis per project, by slug (the "Análisis" tab only shows for projects listed here).
 * Each one is its own chunk, loaded only when the tab is opened.
 */
export const analisis = {
  'se-puede-salir': defineAsyncComponent(() => import('./SePuedeSalirAnalisis.vue')),
  'pulso-hermosillo': defineAsyncComponent(() => import('./PulsoAnalisis.vue')),
}

/** Projects whose analysis lives at the top of the Resumen tab instead of its own tab */
const enResumen = new Set(['se-puede-salir'])

/** A piece of a project's analysis repeated on its Resumen tab, right after the live view */
export const extractoResumen = {
  'pulso-hermosillo': defineAsyncComponent(() => import('./PulsoTemasResumen.vue')),
}

export const analisisEnResumen = (slug) => enResumen.has(slug)
export const tieneAnalisis = (slug) => slug in analisis && !enResumen.has(slug)
