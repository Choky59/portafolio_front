import { iconoFuente } from './emociones.js'

/**
 * HTML layer over the canvas: a title card (button) per news slot and the people's
 * speech bubbles. The scene decides when each card shows (setEstado). HTML instead of 3D text: crisp at any size, real buttons for
 * keyboard and screen readers, and plain CSS for the look.
 * Each frame the 3D positions are projected to the screen.
 *
 * Styles live in the Vue component that hosts the scene (PulsoHermosillo.vue).
 */
const MAX_BURBUJAS = 8
const DURACION_BURBUJA = 2.8

export function crearCapa(THREE, contenedor, { onSeleccion } = {}) {
  const capa = document.createElement('div')
  capa.className = 'pulso-capa'
  contenedor.appendChild(capa)

  const v = new THREE.Vector3()
  let etiquetas = []

  const burbujas = Array.from({ length: MAX_BURBUJAS }, () => {
    const el = document.createElement('div')
    el.className = 'pulso-burbuja'
    el.setAttribute('aria-hidden', 'true')
    capa.appendChild(el)
    return { el, agente: -1, restante: 0 }
  })

  /** Projects a world point; returns false when it's behind the camera */
  function proyectar(camera, x, y, z, ancho, alto) {
    v.set(x, y, z).project(camera)
    if (v.z > 1) return false
    v.x = ((v.x + 1) / 2) * ancho
    v.y = ((1 - v.y) / 2) * alto
    return true
  }

  function colocar(el, visible, x, y) {
    el.style.visibility = visible ? 'visible' : 'hidden'
    if (visible) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
  }

  return {
    /** One card per news slot (noticias.js puntos); the text is set with `escribir` */
    setNoticias(puntos) {
      for (const e of etiquetas) e.el.remove()
      etiquetas = puntos.map((p) => {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'pulso-etiqueta'
        const icono = document.createElement('span')
        icono.className = 'pulso-etiqueta__icono'
        icono.setAttribute('aria-hidden', 'true')
        const texto = document.createElement('span')
        texto.className = 'pulso-etiqueta__texto'
        el.append(icono, texto)
        el.addEventListener('click', () => p.noticia && onSeleccion?.(p.noticia.id))
        capa.appendChild(el)
        return { el, p, icono, texto, mostrar: false }
      })
    },

    /** Writes the slot's current news on its card */
    escribir(k) {
      const e = etiquetas[k]
      const noticia = e?.p.noticia
      if (!noticia) return
      e.el.setAttribute('aria-label', `Ver noticia: ${noticia.titulo}`)
      e.icono.textContent = iconoFuente(noticia.fuente?.tipo)
      e.texto.textContent = noticia.titulo
    },

    /** mostrar[k]: whether slot k's card is shown. Hidden cards can't be clicked or focused */
    setEstado(seleccionId, mostrar) {
      etiquetas.forEach((e, k) => {
        const { el, p } = e
        // Called every frame: only touch the DOM when something changed
        const clave = `${mostrar[k]}|${p.noticia?.id}|${p.activa}|${p.pasaFiltro}|${seleccionId}`
        if (clave === e.clave) return
        e.clave = clave
        e.mostrar = !!(mostrar[k] && p.noticia && p.activa)
        el.classList.toggle('pulso-etiqueta--visible', e.mostrar)
        el.classList.toggle('pulso-etiqueta--oculta', e.mostrar && !p.pasaFiltro)
        el.classList.toggle('pulso-etiqueta--activa', e.mostrar && p.noticia?.id === seleccionId)
        el.tabIndex = e.mostrar ? 0 : -1
        el.setAttribute('aria-hidden', String(!e.mostrar))
      })
    },

    /** Speech bubble over person i. `forzar` (a click) reuses the oldest bubble when all are busy */
    decir(i, texto, emocion, forzar = false) {
      let libre = burbujas.find((b) => b.agente === i) ?? burbujas.find((b) => b.restante <= 0)
      if (!libre && forzar) libre = burbujas.reduce((a, b) => (a.restante < b.restante ? a : b))
      if (!libre) return
      libre.agente = i
      libre.restante = DURACION_BURBUJA
      libre.el.textContent = texto
      libre.el.dataset.emocion = emocion ?? 'neutral'
      libre.el.classList.add('pulso-burbuja--visible')
    },

    hayLugar() {
      return burbujas.some((b) => b.restante <= 0)
    },

    actualizar(dt, camera, ancho, alto, sim, alturaCabeza) {
      for (const { el, p, mostrar } of etiquetas) {
        if (!mostrar) continue
        const ok = proyectar(camera, p.x, 1.1, p.z, ancho, alto)
        colocar(el, ok, v.x, v.y - 6)
      }

      for (const b of burbujas) {
        if (b.restante <= 0) continue
        b.restante -= dt
        if (b.restante <= 0) {
          b.el.classList.remove('pulso-burbuja--visible')
          b.agente = -1
          continue
        }
        const i = b.agente
        const ok = proyectar(camera, sim.x[i], (alturaCabeza + 0.3) * sim.escala[i], sim.z[i], ancho, alto)
        colocar(b.el, ok, v.x, v.y)
      }
    },

    dispose() {
      capa.remove()
    },
  }
}
