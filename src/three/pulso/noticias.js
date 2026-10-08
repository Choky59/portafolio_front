import { pasaFiltro } from './emociones.js'
import { GRAFITO, texturaCirculo } from './lapiz.js'

/**
 * Places where news show up: fixed slots on a golden-angle spiral (slot 0 in the
 * center). A slot can be empty or hold one news item, drawn as a pencil circle on
 * the paper (its size depends on relevance) with a small white pedestal.
 * News pop in and shrink out (`update` animates it). The HTML card with the title
 * lives in burbujas.js.
 *
 * `puntos` (one per slot, always the same array) is what the simulation reads:
 * { x, z, radio, peso, visible, noticia }. Fixed slots keep the simulation's
 * indexes valid while news come and go.
 */
const SEPARACION = 7
const RADIO_MAX = 3.2

export function radioDe(noticia) {
  return 1.6 + (noticia.relevancia ?? 0.5) * 1.6
}

export function crearNoticias(THREE, cantidad, { separacion = SEPARACION, margen = 6 } = {}) {
  const grupo = new THREE.Group()

  const blanco = new THREE.MeshToonMaterial({ color: 0xffffff })
  const negro = new THREE.MeshBasicMaterial({ color: GRAFITO, side: THREE.BackSide })
  const pedestalGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.28, 20)
  const pedestalContorno = pedestalGeo.clone().scale(1.1, 1.15, 1.1)
  const tapaGeo = new THREE.RingGeometry(0.16, 0.24, 20).rotateX(-Math.PI / 2)
  const tapaMat = new THREE.MeshBasicMaterial({ color: GRAFITO })

  let limite = 0
  const puntos = Array.from({ length: cantidad }, (_, i) => {
    const angulo = i * 2.39996
    const r = i === 0 ? 0 : separacion * Math.sqrt(i)
    const x = Math.cos(angulo) * r
    const z = Math.sin(angulo) * r
    limite = Math.max(limite, Math.abs(x) + RADIO_MAX, Math.abs(z) + RADIO_MAX)

    const marcador = new THREE.Group()
    marcador.position.set(x, 0, z)
    marcador.scale.setScalar(0)
    marcador.visible = false

    const pedestal = new THREE.Mesh(pedestalGeo, blanco)
    pedestal.position.y = 0.14
    const contorno = new THREE.Mesh(pedestalContorno, negro)
    contorno.position.y = 0.14
    const tapa = new THREE.Mesh(tapaGeo, tapaMat)
    tapa.position.y = 0.283
    marcador.add(contorno, pedestal, tapa)
    grupo.add(marcador)

    return {
      x, z,
      radio: RADIO_MAX,
      peso: 0,
      visible: false,
      noticia: null,
      /** In use (has a news and isn't leaving) */
      activa: false,
      pasaFiltro: true,
      marcador,
      circulo: null,
      escala: 0,
    }
  })

  let seleccionId = null
  let filtro = {}

  function aplicarEstilo(p) {
    p.visible = p.activa && p.pasaFiltro
    if (!p.circulo) return
    const seleccionada = p.noticia?.id === seleccionId
    p.circulo.material.opacity = !p.pasaFiltro ? 0.18 : seleccionada ? 1 : 0.75
  }

  return {
    grupo,
    puntos,
    limite: limite + margen,

    /** Puts a news item in an empty slot (it pops in) */
    poner(k, noticia) {
      const p = puntos[k]
      if (p.circulo) {
        p.marcador.remove(p.circulo)
        p.circulo.geometry.dispose()
        p.circulo.material.map.dispose()
        p.circulo.material.dispose()
      }
      p.radio = radioDe(noticia)
      p.circulo = new THREE.Mesh(
        new THREE.PlaneGeometry(p.radio * 2, p.radio * 2).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          map: texturaCirculo(THREE, k * 31 + noticia.id.length),
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        })
      )
      p.circulo.position.y = 0.005
      p.circulo.rotation.y = k // each drawing starts at a different angle
      p.marcador.add(p.circulo)

      p.noticia = noticia
      p.peso = 0.15 + (noticia.relevancia ?? 0.5)
      p.activa = true
      p.pasaFiltro = pasaFiltro(noticia, filtro)
      p.marcador.visible = true
      aplicarEstilo(p)
    },

    /** Takes the news out of a slot (it shrinks away; the slot is free when escala hits 0) */
    quitar(k) {
      puntos[k].activa = false
      aplicarEstilo(puntos[k])
    },

    /** Returns true if any visibility changed */
    setFiltro(nuevo) {
      filtro = nuevo ?? {}
      let cambio = false
      for (const p of puntos) {
        const antes = p.visible
        p.pasaFiltro = p.noticia ? pasaFiltro(p.noticia, filtro) : true
        aplicarEstilo(p)
        if (p.visible !== antes) cambio = true
      }
      return cambio
    },

    setSeleccion(id) {
      seleccionId = id
      for (const p of puntos) aplicarEstilo(p)
    },

    /** Pop in / shrink out, and a gentle pulse of the selected circle */
    update(t, dt) {
      for (const p of puntos) {
        if (!p.marcador.visible) continue
        const meta = p.activa ? 1 : 0
        p.escala += (meta - p.escala) * Math.min(1, (dt || 1) * 5)
        if (!p.activa && p.escala < 0.02) {
          p.escala = 0
          p.marcador.visible = false
          p.noticia = null
        }
        const pulso = p.noticia && p.noticia.id === seleccionId && p.visible ? 1 + Math.sin(t * 3) * 0.025 : 1
        p.marcador.scale.setScalar(p.escala * pulso)
      }
    },

    /** A slot that can take a new news item */
    libre(k) {
      return !puntos[k].marcador.visible
    },
  }
}
