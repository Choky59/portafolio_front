import { pasaFiltro } from './emociones.js'

/**
 * Life cycle of the news on the map (no Three.js):
 * - Only a few news are on the map at once; the rest wait in a queue.
 * - A news pops in on a free slot and shows its title for a few seconds.
 * - After that, the title only shows while the user's group is near it, the
 *   marker is inside its circle, or it's the selected one.
 * - A news nobody visits expires and goes back to the end of the queue; another
 *   one takes its place. Visiting it (group near or marker inside) restarts its life.
 *
 * `noticias` is the slot manager from noticias.js.
 */
const TITULO_AL_APARECER = 4
const VIDA_MIN = 22
const VIDA_MAX = 34
const ESPERA_ENTRE_NUEVAS = 2.5
const ENFRIAR_LUGAR = 3 // a slot rests a bit before taking another news

export function crearCiclo(noticias, { activasMax, random, fijo = false }) {
  const lugares = noticias.puntos.map(() => ({ vida: 0, tituloHasta: 0, enfriar: 0 }))
  let cola = []
  let esperaNueva = 0

  function vidaNueva() {
    return VIDA_MIN + random() * (VIDA_MAX - VIDA_MIN)
  }

  function activas() {
    return noticias.puntos.filter((p) => p.activa).length
  }

  /** Next queued news that passes the filter (taken out of the queue) */
  function siguiente(filtro) {
    const i = cola.findIndex((n) => pasaFiltro(n, filtro))
    return i >= 0 ? cola.splice(i, 1)[0] : null
  }

  function lugarLibre() {
    const libres = []
    noticias.puntos.forEach((_, k) => {
      if (noticias.libre(k) && lugares[k].enfriar <= 0) libres.push(k)
    })
    return libres.length ? libres[Math.floor(random() * libres.length)] : -1
  }

  /** Puts the next news on the map; returns its slot or -1 */
  function entrar(t, filtro) {
    const k = lugarLibre()
    if (k < 0) return -1
    const noticia = siguiente(filtro)
    if (!noticia) return -1
    noticias.poner(k, noticia)
    lugares[k].vida = vidaNueva()
    lugares[k].tituloHasta = t + TITULO_AL_APARECER
    return k
  }

  return {
    /** New list of news: empties the map and queues them (shuffled) */
    reiniciar(lista, t, filtro) {
      noticias.puntos.forEach((p, k) => p.activa && noticias.quitar(k))
      cola = [...lista]
      for (let i = cola.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[cola[i], cola[j]] = [cola[j], cola[i]]
      }
      esperaNueva = ESPERA_ENTRE_NUEVAS
      const nuevas = []
      // Half the map right away (the rest arrives one by one);
      // reduced motion: everything at once, and nothing expires
      const iniciales = fijo ? activasMax : Math.ceil(activasMax / 2)
      while (activas() < iniciales) {
        const k = entrar(t, filtro)
        if (k < 0) break
        nuevas.push(k)
      }
      return nuevas
    },

    /**
     * cerca(k): the user's group or marker is at slot k.
     * Returns { nuevas: slots that got a news, salieron: slots that lost one, mostrar: bool per slot }
     */
    update(dt, t, { cerca, seleccionId, filtro }) {
      const nuevas = []
      const salieron = []

      noticias.puntos.forEach((p, k) => {
        const lugar = lugares[k]
        lugar.enfriar -= dt
        if (!p.activa || fijo) return
        if (cerca(k) || p.noticia.id === seleccionId) {
          lugar.vida = Math.max(lugar.vida, VIDA_MIN)
        } else {
          lugar.vida -= dt
          if (lugar.vida <= 0) {
            cola.push(p.noticia)
            noticias.quitar(k)
            lugar.enfriar = ENFRIAR_LUGAR
            salieron.push(k)
          }
        }
      })

      if (!fijo) {
        esperaNueva -= dt
        if (esperaNueva <= 0 && activas() < activasMax) {
          const k = entrar(t, filtro)
          if (k >= 0) nuevas.push(k)
          esperaNueva = ESPERA_ENTRE_NUEVAS
        }
      }

      const mostrar = noticias.puntos.map(
        (p, k) => p.activa && (fijo || t < lugares[k].tituloHasta || cerca(k) || p.noticia.id === seleccionId)
      )
      return { nuevas, salieron, mostrar }
    },
  }
}
