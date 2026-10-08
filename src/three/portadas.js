/**
 * 3D cover per project, by slug. Each entry is a lazy import so a scene
 * is only downloaded when its card or header is on screen.
 *
 * To give a new project its own cover:
 *   1. create src/three/escenas/<slug>.js (see stage.js for the scene contract)
 *   2. add a line here: '<slug>': () => import('./escenas/<slug>.js'),
 * Projects without an entry use the generic cover.
 */
const portadas = {
  'se-puede-salir': () => import('./escenas/se-puede-salir.js'),
  'pulso-hermosillo': () => import('./escenas/pulso-portada.js'),
}

export function cargarPortada(slug) {
  const cargar = portadas[slug] ?? (() => import('./escenas/generica.js'))
  return cargar()
}
