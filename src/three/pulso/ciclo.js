import { pasaFiltro } from './emociones.js'

/**
 * Life cycle of the news on the map (no Three.js), in rounds:
 * - A round puts `activasMax` news (5–6) on the map at once, one per slot.
 * - After a short while they all leave together; once they've shrunk away and the
 *   crowd is back in line (`listos`), the next round pops in, all at once again.
 *   News go back to the end of the queue, so every news gets its turn.
 * - While a news is selected (its panel is open) the round doesn't end.
 * - Titles go around once per round: starting at a random news, each one shows for
 *   TITULO seconds and then the next one counterclockwise (as seen on screen). The
 *   selected news always shows its card. With reduced motion all titles stay on.
 *
 * `noticias` is the slot manager from noticias.js.
 */
const DURACION_RONDA = 20 // seconds a round stays on the map
const PAUSA = 0.6 // at least this long with the map empty between rounds
const ESPERA_MAX = 15 // never wait longer than this for the crowd to line up
const PRIMERA_PAUSA = 2 // seconds lined up before the very first round
const TITULO = 4 // seconds each title shows in its turn

export function crearCiclo(noticias, { activasMax, random, fijo = false }) {
  let cola = []
  let restante = 0
  let pausa = 0
  let cambiando = false
  let terminar = false
  /** Slots in the order their titles show this round, and time since the round started */
  let turnos = []
  let reloj = 0

  /** Next queued news that passes the filter (taken out of the queue) */
  function siguiente(filtro) {
    const i = cola.findIndex((n) => pasaFiltro(n, filtro))
    return i >= 0 ? cola.splice(i, 1)[0] : null
  }

  /** Fills every free slot with the next news; returns the slots that got one */
  function ronda(filtro) {
    const nuevas = []
    noticias.puntos.forEach((_, k) => {
      if (nuevas.length >= activasMax || !noticias.libre(k)) return
      const noticia = siguiente(filtro)
      if (!noticia) return
      noticias.poner(k, noticia)
      nuevas.push(k)
    })
    // Titles: from a random news, counterclockwise. Slots go clockwise on screen (the
    // first one at the top, then to the right), so counterclockwise is going down.
    const inicio = Math.floor(random() * nuevas.length)
    turnos = nuevas.map((_, j) => nuevas[(((inicio - j) % nuevas.length) + nuevas.length) % nuevas.length])
    reloj = 0
    // Long enough for every title to get its turn
    restante = Math.max(DURACION_RONDA, turnos.length * TITULO + 1)
    return nuevas
  }

  return {
    /**
     * New list of news: empties the map and queues them (shuffled). The first round
     * comes after a moment with the crowd lined up (right away with reduced motion).
     */
    reiniciar(lista, filtro) {
      noticias.puntos.forEach((p, k) => p.activa && noticias.quitar(k))
      cola = [...lista]
      for (let i = cola.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[cola[i], cola[j]] = [cola[j], cola[i]]
      }
      // Reduced motion: the first round right away (nothing would animate the wait)
      if (fijo && noticias.puntos.every((_, k) => noticias.libre(k))) {
        cambiando = false
        return ronda(filtro)
      }
      // Otherwise the crowd is seen lined up for a moment before the first round
      cambiando = true
      pausa = PRIMERA_PAUSA
      return []
    },

    /** Ends the current round now (the filter changed: the next round brings news that match) */
    terminarRonda() {
      if (!cambiando) terminar = true
    },

    /**
     * listos: the crowd is back in line, so the next round can come.
     * Returns { nuevas: slots that got a news, salieron: slots that lost one, mostrar: bool per slot }
     */
    update(dt, { seleccionId, filtro, listos = true }) {
      const nuevas = []
      const salieron = []
      const abierta = noticias.puntos.some((p) => p.activa && p.noticia.id === seleccionId)

      if (!cambiando && !abierta) {
        if (!fijo) restante -= dt
        if (restante <= 0 || terminar) {
          terminar = false
          // The whole round leaves together
          noticias.puntos.forEach((p, k) => {
            if (!p.activa) return
            cola.push(p.noticia)
            noticias.quitar(k)
            salieron.push(k)
          })
          cambiando = true
          pausa = PAUSA
          // Reduced motion: no shrink animation nor pause, the next round right away
          if (fijo) {
            noticias.update(0, 1)
            cambiando = false
            nuevas.push(...ronda(filtro))
          }
        }
      } else if (cambiando) {
        // Next round once every slot is free (shrink animation over), the crowd is back in line and the pause is over
        pausa = fijo ? 0 : pausa - dt // reduced motion may not advance time
        const formados = listos || pausa < PAUSA - ESPERA_MAX
        if (pausa <= 0 && formados && noticias.puntos.every((_, k) => noticias.libre(k))) {
          cambiando = false
          nuevas.push(...ronda(filtro))
        }
      }

      // Whose title it is now (none once they've all had their turn, or between rounds)
      reloj += dt
      const turno = cambiando ? -1 : (turnos[Math.floor(reloj / TITULO)] ?? -1)
      const mostrar = noticias.puntos.map(
        (p, k) => p.activa && (fijo || k === turno || p.noticia.id === seleccionId)
      )
      return { nuevas, salieron, mostrar }
    },
  }
}
