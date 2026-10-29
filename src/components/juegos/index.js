import { defineAsyncComponent } from 'vue'

/**
 * Playable game per project, by slug: shown at the top of the project's summary.
 * Each one is its own chunk, loaded only on that project's page.
 */
export const juegos = {
  'carreras-hermosillo': defineAsyncComponent(() => import('./CarrerasHermosillo.vue')),
}
