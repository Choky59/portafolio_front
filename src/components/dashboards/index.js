import { defineAsyncComponent } from 'vue'

/**
 * Live dashboard per project, by slug (only used when the project has enVivo: true).
 * Each one is its own chunk, loaded only on that project's page.
 */
export const dashboards = {
  'se-puede-salir': defineAsyncComponent(() => import('./SePuedeSalir.vue')),
}
