import { defineAsyncComponent } from 'vue'

/**
 * Data analysis per project, by slug (the "Análisis" tab only shows for projects listed here).
 * Each one is its own chunk, loaded only when the tab is opened.
 */
export const analisis = {
  'se-puede-salir': defineAsyncComponent(() => import('./SePuedeSalirAnalisis.vue')),
  'pulso-hermosillo': defineAsyncComponent(() => import('./PulsoAnalisis.vue')),
}

export const tieneAnalisis = (slug) => slug in analisis
