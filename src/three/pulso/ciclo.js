/**
 * Life cycle of the news on the map (no Three.js). The news keep changing, one at a time:
 * - The map holds up to `activasMax` news (one per slot of noticias.js, each at a free
 *   spot anywhere on the map). The first ones come after a moment with the crowd lined up.
 * - A tour visits them in the order they arrived (the camera zooms into the one whose
 *   turn it is, see escenas/pulso-hermosillo.js): after LLEGADA seconds for the crowd to
 *   reach them, each one gets TITULO seconds, then the next. `siguiente` / `anterior`
 *   move it by hand.
 * - A news more than ATRAS steps behind the tour leaves the map, and the next one in the
 *   queue pops in at a free spot. News go back to the end of the queue, so every news
 *   gets its turn, and the ones never shown come first.
 * - The tour remembers the last HISTORIAL news it showed, even off the map: going back
 *   (or forward again) to one that left puts it back at a free spot (making room if
 *   needed) and the crowd walks over to it.
 * - On the last news never shown (`ultima`) the tour waits ESPERA_ULTIMA seconds, so
 *   there's time to load more (`agregar`); then it goes on with the ones already shown.
 * - `aFila` sends everyone back to the grid: all the news leave and, once the crowd is
 *   in line, the map fills up and the tour starts over.
 * - While a news is selected (its modal is open) the tour waits.
 * - With reduced motion there's no tour: the news stay and all titles stay on.
 *
 * `noticias` is the slot manager from noticias.js.
 */
const PAUSA = 0.6 // at least this long with the map empty before it fills up again
const ESPERA_MAX = 15 // never wait longer than this for the crowd to line up
const PRIMERA_PAUSA = 2 // seconds lined up before the very first news
const LLEGADA = 4 // seconds for the crowd to reach the news before the first turn
const TITULO = 8 // seconds the camera stays on each news
const ESPERA_ULTIMA = 15 // seconds the last news never shown waits for "cargar más"
const ATRAS = 1 // news behind the tour that stay on the map
const HISTORIAL = 50 // news the tour remembers (Anterior goes back through them)

export function crearCiclo(noticias, { random, fijo = false }) {
  const puntos = noticias.puntos
  /** News off the map: never shown first, then the ones already shown */
  let cola = []
  /** Ids the tour has already shown, and how many news there are in all */
  const vistas = new Set()
  const conocidas = new Set()
  /** Everyone going back to the grid: no news until they're lined up */
  let formando = false
  let pausa = 0
  /** News the tour showed, in order (they may be off the map now), the current one, and time on it */
  let historial = []
  let pos = -1
  let reloj = 0
  /** A news of the history coming back to the map (waiting for a free slot) */
  let pendiente = null
  /** Per slot: arrival order of its news (the tour goes oldest first) and whether the tour showed it there */
  const llego = puntos.map(() => 0)
  const recorrida = puntos.map(() => false)
  let contador = 0
  /** The news that was the last one never shown when the tour got to it (false once the tour moved on) */
  let idUltima = null

  const slotDe = (id) => puntos.findIndex((p) => p.activa && p.noticia?.id === id)
  const faltanPorVer = () => conocidas.size - vistas.size
  /** Slot of the news the tour is on, or -1 (none yet, or still coming back to the map) */
  const actual = () => (historial[pos] ? slotDe(historial[pos].id) : -1)
  const esUltima = () => actual() >= 0 && historial[pos].id === idUltima && faltanPorVer() === 0

  /** Unseen news first, in their order; the ones already shown after them */
  function ordenarCola() {
    cola = [...cola.filter((n) => !vistas.has(n.id)), ...cola.filter((n) => vistas.has(n.id))]
  }

  function poner(k, noticia, nuevas) {
    noticias.poner(k, noticia)
    llego[k] = ++contador
    recorrida[k] = false
    nuevas.push(k)
  }

  /** The news coming back first, then one from the queue in every free slot */
  function llenar(nuevas) {
    puntos.forEach((_, k) => {
      if (!noticias.libre(k)) return
      if (pendiente) {
        poner(k, pendiente, nuevas)
        pendiente = null
      } else if (cola.length) {
        poner(k, cola.shift(), nuevas)
      }
    })
  }

  function quitar(k, salieron, alFrente = false) {
    if (alFrente) cola.unshift(puntos[k].noticia)
    else cola.push(puntos[k].noticia)
    noticias.quitar(k)
    salieron.push(k)
  }

  /** Last place of a news in the history (-1: not there) */
  function enHistorial(id) {
    for (let i = historial.length - 1; i >= 0; i--) if (historial[i].id === id) return i
    return -1
  }

  /**
   * The news at historial[i] isn't on the map: it comes back. If every slot is busy,
   * one makes room: the shown news farthest from the tour, else the newest one not shown yet.
   */
  function traer(i, salieron) {
    const noticia = historial[i].noticia
    if (pendiente && pendiente.id !== noticia.id) cola.push(pendiente)
    cola = cola.filter((n) => n.id !== noticia.id)
    pendiente = noticia
    if (puntos.some((p) => !p.activa)) return // a slot is free or about to be
    let sale = -1
    let lejos = -1
    puntos.forEach((p, k) => {
      if (!recorrida[k]) return
      const j = enHistorial(p.noticia.id)
      const d = j < 0 ? Infinity : Math.abs(j - i)
      if (d > lejos) {
        lejos = d
        sale = k
      }
    })
    if (sale >= 0) return quitar(sale, salieron)
    puntos.forEach((_, k) => {
      if (sale < 0 || llego[k] > llego[sale]) sale = k
    })
    quitar(sale, salieron, true) // not shown yet: it comes back next
  }

  /** The oldest news on the map the tour hasn't shown there */
  function proxima() {
    let mejor = -1
    puntos.forEach((p, k) => {
      if (p.activa && !recorrida[k] && (mejor < 0 || llego[k] < llego[mejor])) mejor = k
    })
    return mejor
  }

  /** Goes to historial[i], bringing it back to the map if it left */
  function irA(i, salieron) {
    pos = i
    reloj = 0
    if (actual() < 0) traer(i, salieron)
  }

  function avanzar(salieron) {
    if (idUltima && historial[pos]?.id === idUltima) idUltima = false
    if (pos < historial.length - 1) {
      irA(pos + 1, salieron)
    } else {
      const k = proxima()
      if (k < 0) return
      const noticia = puntos[k].noticia
      historial.push({ id: noticia.id, noticia })
      if (historial.length > HISTORIAL) historial.shift()
      pos = historial.length - 1
      reloj = 0
      vistas.add(noticia.id)
      if (faltanPorVer() === 0 && idUltima === null) idUltima = noticia.id
    }
    // The news shown too far behind leave the map (the next ones in the queue take their place)
    puntos.forEach((p, k) => {
      if (!p.activa || !recorrida[k] || k === actual()) return
      if (enHistorial(p.noticia.id) < pos - ATRAS) quitar(k, salieron)
    })
  }

  function formar(segundos) {
    if (pendiente) cola.push(pendiente)
    pendiente = null
    historial = []
    pos = -1
    reloj = 0
    formando = true
    pausa = segundos
  }

  const ciclo = {
    /** New list of news: empties the map and queues them (shuffled) */
    reiniciar(lista) {
      puntos.forEach((p, k) => p.activa && noticias.quitar(k))
      cola = [...lista]
      for (let i = cola.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[cola[i], cola[j]] = [cola[j], cola[i]]
      }
      vistas.clear()
      conocidas.clear()
      idUltima = null
      for (const n of lista) conocidas.add(n.id)
      pendiente = null
      // Reduced motion: the map fills up right away (nothing would animate the wait)
      formar(fijo ? 0 : PRIMERA_PAUSA)
      if (fijo) noticias.update(0, 1)
    },

    /** More news (already in the queue's order): they come before the ones already shown */
    agregar(lista) {
      for (const n of lista) {
        if (conocidas.has(n.id)) continue
        conocidas.add(n.id)
        cola.push(n)
      }
      // There are unseen news again: the next "last one" is whichever ends them
      if (faltanPorVer() > 0) idUltima = null
      ordenarCola()
    },

    siguiente() {
      if (!formando && !fijo) avanzar([])
    },

    anterior() {
      if (formando || fijo || pos <= 0) return
      irA(pos - 1, [])
    },

    /** Everyone back to the grid, then the map fills up again */
    aFila() {
      if (formando) return
      puntos.forEach((p, k) => p.activa && quitar(k, []))
      formar(PAUSA)
      ordenarCola()
      if (fijo) noticias.update(0, 1)
    },

    /**
     * listos: the crowd is back in line, so the map can fill up.
     * Returns { nuevas: slots that got a news, salieron: slots that lost one, mostrar: bool per slot,
     * turno: slot the tour is on (or -1), atras: there's a previous news, ultima: the last news
     * never shown, recorrido: the tour is running }
     */
    update(dt, { seleccionId, listos = true }) {
      const nuevas = []
      const salieron = []
      const abierta = puntos.some((p) => p.activa && p.noticia.id === seleccionId)

      if (formando) {
        // Once every slot is free (shrink animation over), the crowd is in line and the pause is over
        pausa = fijo ? 0 : pausa - dt // reduced motion may not advance time
        const formados = listos || pausa < -ESPERA_MAX
        if (pausa <= 0 && formados && puntos.every((_, k) => noticias.libre(k))) {
          formando = false
          llenar(nuevas)
          reloj = 0
        }
      } else {
        // The news coming back, and a new one in the place of each one that left
        llenar(nuevas)
        // The time on a news coming back starts once it's on the map (the crowd walks over meanwhile)
        if (!abierta && !fijo && (pos < 0 || actual() >= 0)) {
          reloj += dt
          const espera = pos < 0 ? LLEGADA : esUltima() ? ESPERA_ULTIMA : TITULO
          if (reloj >= espera) avanzar(salieron)
        }
      }

      const enTour = !formando && !fijo
      const turno = enTour ? actual() : -1
      if (turno >= 0) recorrida[turno] = true
      return {
        nuevas,
        salieron,
        // With the tour the title shows above the scene (PulsoHermosillo.vue), so the cards stay hidden
        mostrar: puntos.map((p) => p.activa && fijo),
        turno,
        atras: enTour && pos > 0,
        ultima: enTour && esUltima(),
        recorrido: enTour,
      }
    },
  }
  return ciclo
}
