import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { crearSimulacion } from '../pulso/simulacion.js'
import { crearMultitud } from '../pulso/multitud.js'
import { crearNoticias } from '../pulso/noticias.js'
import { crearCiclo } from '../pulso/ciclo.js'
import { crearCapa } from '../pulso/burbujas.js'
import { crearParticulas } from '../pulso/particulas.js'
import { ANIMACIONES } from '../pulso/animaciones.js'
import { FRASES } from '../pulso/emociones.js'
import { texturaPapel } from '../pulso/lapiz.js'
import { rng } from '../piezas.js'

/**
 * "El pulso de Hermosillo": people gather around news and take the color of the
 * emotion each news item causes. Drawn like pencil on paper: white world, white
 * people, black outlines; the only color is the emotion.
 *
 * - Everyone starts lined up in a grid spread over the whole view. The map has 5–6 news,
 *   evenly spaced on a circle around it; small groups spread over them by
 *   relevance, running until they get to theirs, and stay a while; now and then a
 *   group moves to another news (simulacion.js). Titles stay hidden until a news
 *   is clicked.
 * - Stepping into a news' circle, each person takes ONE emotion from that news'
 *   mix, so a controversial news gathers a crowd of several colors. Moving to
 *   another news, the color fades on the way and a new one is drawn there.
 * - News change in rounds (ciclo.js): after a short while they all leave together,
 *   everyone runs back to its grid spot and, once they're all in line, the next
 *   5–6 pop in at once and everyone runs to pick one.
 * - A click or tap on a news (its circle or its card) opens it; on a person, that
 *   person says something; on empty ground it closes the open news.
 *
 * params = {
 *   noticias,                      array with the shape of src/data/pulsoDemo.js
 *   filtro: { emocion, fuente, categoria },
 *   seleccionId,                   highlighted news (or null)
 *   modo: 'embebido' | 'completo', embedded: the mouse wheel only zooms with Ctrl/⌘
 *                                  and touch devices don't pan (the page must scroll)
 *   onSeleccion(id | null),        click on a news card, its circle or the empty ground
 * }
 */
const ELEVACION = (55 * Math.PI) / 180
/** Starting distance of the camera; farther if needed so the whole circle of news fits */
const DISTANCIA_INICIAL = 62
/** News on the map at once, and the radius of the circle they sit on */
const ACTIVAS = { web: 6, movil: 5 }
const CIRCULO = { web: 11, movil: 9.5 }
/** Room kept around the circle when framing it: the news' own circles and their cards */
const MARCO = 6
/** People on the map */
const PERSONAS = { web: 180, movil: 110 }
/**
 * Room left between the grid and the edges of the view, in ground units: more at the
 * far edge (the figures stand up into it, and the badges sit there) than at the sides.
 */
const BORDE = { lados: 1.6, fondo: 3.2, frente: 1.2 }

export default function crearPulsoHermosillo() {
  let THREE, camera, canvas, controls, sim, multitud, particulas, noticias, ciclo, capa, paleta, scene
  let params = {}
  let ancho = 1
  let alto = 1
  let firmaNoticias = ''
  let reducido = false
  let tiempoFrase = 0
  let radioCirculo = CIRCULO.web
  let camaraMovida = false // once the user pans or zooms, a resize no longer reframes
  let arranco = false // the crowd has moved (until then a new grid area moves everyone at once)
  const quitar = []
  const random = rng(11)

  function firma(lista) {
    return (lista ?? []).map((n) => n.id).join('|')
  }

  /** New list of news: back to the queue, the map fills up again */
  function montarNoticias(lista) {
    const nuevas = ciclo.reiniciar(lista ?? [], params.filtro ?? {})
    for (const k of nuevas) capa.escribir(k)
    sim.actualizarVisibilidad()
    firmaNoticias = firma(lista)
    if (reducido) sim.asentar()
  }

  /** Camera at the starting angle, far enough for the whole circle to fit the view */
  function encuadrar() {
    const mitad = ((camera.fov / 2) * Math.PI) / 180
    const alcance = radioCirculo + MARCO
    const paraAlto = alcance / Math.tan(mitad)
    const paraAncho = alcance / (Math.tan(mitad) * camera.aspect)
    const d = Math.max(DISTANCIA_INICIAL, paraAlto, paraAncho)
    camera.position.set(0, Math.sin(ELEVACION) * d, Math.cos(ELEVACION) * d)
    camera.lookAt(0, 0, 0)
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.maxDistance = Math.max(110, d * 1.3)
      controls.update()
    }
    // Reduced motion skips this: the crowd is already settled at its news (sim.asentar)
    sim.setFila(areaVisible(), { mover: !arranco && !reducido })
  }

  /**
   * The part of the ground the camera sees: a trapezoid, wider at the far edge.
   * Returned as its depth range and the half width at each end (see sim.setFila),
   * minus the room in BORDE.
   */
  function areaVisible() {
    camera.updateMatrixWorld()
    const esquina = (nx, ny) => {
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera)
      return raycaster.ray.intersectPlane(plano, new THREE.Vector3()) ?? new THREE.Vector3(nx * 20, 0, -ny * 20)
    }
    const lejos = esquina(1, 1)
    const cerca = esquina(1, -1)
    const z0 = lejos.z + BORDE.fondo
    const z1 = cerca.z - BORDE.frente
    // The side edges are straight lines on the ground: half width at any depth
    const medioEn = (z) => Math.abs(lejos.x + ((cerca.x - lejos.x) * (z - lejos.z)) / (cerca.z - lejos.z))
    return { z0, z1, medio0: medioEn(z0) - BORDE.lados, medio1: medioEn(z1) - BORDE.lados }
  }

  /* ---------- clicks: a person (bubble), a news circle (open it) or the empty ground ---------- */

  let raycaster, plano, enSuelo
  function alSuelo(clientX, clientY) {
    const rect = canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(ndc, camera)
    return raycaster.ray.intersectPlane(plano, enSuelo)
  }

  const v = { x: 0, y: 0 }
  function aPantalla(x, y, z) {
    const p = new THREE.Vector3(x, y, z).project(camera)
    v.x = ((p.x + 1) / 2) * ancho
    v.y = ((1 - p.y) / 2) * alto
    return p.z <= 1
  }

  function clic(px, py, clientX, clientY) {
    // A person right under the pointer says something
    let mejor = -1
    let mejorD = 16
    for (let i = 0; i < sim.n; i++) {
      if (!aPantalla(sim.x[i], multitud.alturaCabeza * sim.escala[i], sim.z[i])) continue
      const d = Math.hypot(v.x - px, v.y - py)
      if (d < mejorD) {
        mejorD = d
        mejor = i
      }
    }
    if (mejor >= 0) {
      const emocion = sim.claveEmocion(mejor) ?? 'neutral'
      const frases = FRASES[emocion]
      capa.decir(mejor, frases[Math.floor(random() * frases.length)], emocion, true)
    }

    // Inside a news' circle it opens that news; empty ground closes the open one
    const punto = alSuelo(clientX, clientY)
    const dentro = punto && noticias.puntos.find((q) => q.visible && (punto.x - q.x) ** 2 + (punto.z - q.z) ** 2 < q.radio ** 2)
    params.onSeleccion?.(dentro ? dentro.noticia.id : null)
  }

  function escuchar(el, evento, fn, opciones) {
    el.addEventListener(evento, fn, opciones)
    quitar.push(() => el.removeEventListener(evento, fn, opciones))
  }

  return {
    tiempoEstatico: 0,

    setup(ctx) {
      ;({ THREE, camera, canvas, paleta, scene } = ctx)
      params = ctx.params ?? {}
      reducido = ctx.reducedMotion

      const movil = window.matchMedia('(max-width: 720px)').matches
      const tactil = window.matchMedia('(pointer: coarse)').matches
      const embebido = params.modo !== 'completo'

      // Lights for the toon material: soft fill + one sun from the upper left
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 1.6))
      const sol = new THREE.DirectionalLight(0xffffff, 1.6)
      sol.position.set(-6, 12, -4)
      scene.add(sol)

      const papel = texturaPapel(THREE)
      papel.repeat.set(60, 60)
      const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: papel })
      )
      scene.add(suelo)

      raycaster = new THREE.Raycaster()
      plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      enSuelo = new THREE.Vector3()

      // One slot per news, evenly spaced on a circle
      const activasMax = movil ? ACTIVAS.movil : ACTIVAS.web
      radioCirculo = movil ? CIRCULO.movil : CIRCULO.web
      noticias = crearNoticias(THREE, activasMax, { circulo: radioCirculo })
      scene.add(noticias.grupo)

      sim = crearSimulacion(movil ? PERSONAS.movil : PERSONAS.web, {
        seed: 7,
        limite: noticias.limite,
        estancia: [8, 16],
        cambiar: 0.35,
        fila: true,
        apretar: Object.fromEntries(Object.entries(ANIMACIONES).map(([c, a]) => [c, a.cuerpo?.apretar ?? 0])),
      })
      sim.setPuntos(noticias.puntos, { limite: noticias.limite, todos: true })
      multitud = crearMultitud(THREE, sim, paleta)
      scene.add(multitud.grupo)
      // What the emotions give off (veins, confetti, tears...); none with reduced motion
      if (!reducido) {
        particulas = crearParticulas(THREE, sim, multitud, paleta)
        scene.add(particulas.grupo)
      }

      capa = crearCapa(THREE, canvas.parentElement, {
        onSeleccion: (id) => params.onSeleccion?.(id),
      })
      capa.setNoticias(noticias.puntos)

      ciclo = crearCiclo(noticias, { activasMax, random, fijo: reducido })
      montarNoticias(params.noticias)

      camera.fov = 30
      camera.near = 0.5
      camera.far = 400
      camera.updateProjectionMatrix()

      // Pan / zoom. Embedded on touch: no controls, so a finger scrolls the page.
      if (!(embebido && tactil)) {
        controls = new MapControls(camera, canvas)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.screenSpacePanning = false
        controls.minDistance = 10
        controls.minPolarAngle = 0.25
        controls.maxPolarAngle = 1.15
        controls.addEventListener('start', () => (camaraMovida = true))

        if (embebido) {
          // The controls listen for the wheel on the canvas: stopping the event on the way
          // down (capture on the parent) keeps it from them, and the page still scrolls.
          escuchar(
            canvas.parentElement,
            'wheel',
            (e) => {
              if (!e.ctrlKey && !e.metaKey) e.stopPropagation()
            },
            { capture: true }
          )
        }
      } else {
        canvas.style.touchAction = 'pan-y'
      }

      // Click vs drag: only a short, still press counts as a click (dragging pans the map)
      let inicio = null
      escuchar(canvas, 'pointerdown', (e) => {
        inicio = { x: e.clientX, y: e.clientY, t: performance.now() }
      })
      escuchar(canvas, 'pointerup', (e) => {
        if (!inicio) return
        const quieto = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < 6
        const corto = performance.now() - inicio.t < 500
        inicio = null
        if (!quieto || !corto) return
        const rect = canvas.getBoundingClientRect()
        clic(e.clientX - rect.left, e.clientY - rect.top, e.clientX, e.clientY)
      })

      encuadrar()
      multitud.actualizar()
    },

    setParams(next) {
      params = next ?? {}
      if (!sim) return
      if (firma(params.noticias) !== firmaNoticias) {
        montarNoticias(params.noticias)
        return
      }
      if (noticias.setFiltro(params.filtro ?? {})) {
        sim.actualizarVisibilidad()
        // The next round brings news that match the filter
        ciclo.terminarRonda()
      }
      noticias.setSeleccion(params.seleccionId ?? null)
    },

    resize(w, h) {
      ancho = w
      alto = h
      if (camera && !camaraMovida) encuadrar()
    },

    update(dt, t) {
      if (controls) {
        controls.update()
        // Keep the view over the crowd
        const lim = sim.limite
        const tgt = controls.target
        const cx = Math.max(-lim, Math.min(lim, tgt.x))
        const cz = Math.max(-lim, Math.min(lim, tgt.z))
        if (cx !== tgt.x || cz !== tgt.z) {
          camera.position.x += cx - tgt.x
          camera.position.z += cz - tgt.z
          tgt.x = cx
          tgt.z = cz
        }
      }

      // Rounds of news: when they leave everyone stands still; when the next ones come, everyone picks one
      const { nuevas, salieron, mostrar } = ciclo.update(dt, {
        seleccionId: params.seleccionId ?? null,
        filtro: params.filtro ?? {},
        listos: reducido || sim.enFila(),
      })
      for (const k of nuevas) capa.escribir(k)
      if (salieron.length || nuevas.length) sim.actualizarVisibilidad()
      if (nuevas.length && reducido) sim.asentar() // no animation: jump to the new arrangement
      capa.setEstado(params.seleccionId ?? null, mostrar)

      if (!reducido && dt > 0) {
        arranco = true
        const llegadas = sim.paso(dt)

        // A few of the people that just arrived say something (not all: it'd be noise)
        tiempoFrase -= dt
        if (llegadas.length && tiempoFrase <= 0 && capa.hayLugar()) {
          const i = llegadas[Math.floor(random() * llegadas.length)]
          const emocion = sim.claveEmocion(i) ?? 'neutral'
          const frases = FRASES[emocion]
          capa.decir(i, frases[Math.floor(random() * frases.length)], emocion)
          tiempoFrase = 0.35 + random() * 0.6
        }
      }

      noticias.update(t, reducido ? 1 : dt)
      multitud.actualizar(t, reducido)
      particulas?.actualizar(dt, camera, noticias.puntos)
      capa.actualizar(dt, camera, ancho, alto, sim, multitud.alturaCabeza)
    },

    dispose() {
      for (const fn of quitar) fn()
      controls?.dispose()
      capa?.dispose()
    },
  }
}
