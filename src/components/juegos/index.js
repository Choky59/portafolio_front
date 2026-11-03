/**
 * Juegos de los proyectos, por slug: el juego ya no vive en el portafolio, se juega en su
 * propia página. Aquí solo queda a dónde mandar al visitante (VITE_EDGE_RACERS_URL).
 */
export const EDGE_RACERS_URL = (import.meta.env.VITE_EDGE_RACERS_URL || 'https://edge-racers.web.app/').trim()

export const juegos = {
  'carreras-hermosillo': {
    nombre: 'Edge Racers',
    url: EDGE_RACERS_URL,
    texto:
      'Carreras multijugador en línea: hasta 8 jugadores por sala, bots, items, copas y pistas de Sonora. Se juega en el navegador o en la app para iPhone y Android.',
  },
}
