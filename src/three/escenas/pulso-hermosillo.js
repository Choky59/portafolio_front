import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { crearSimulacion } from '../pulso/simulacion.js'
import { crearMultitud } from '../pulso/multitud.js'
import { crearNoticias } from '../pulso/noticias.js'
import { crearCiclo } from '../pulso/ciclo.js'
import { crearCapa } from '../pulso/burbujas.js'
import { FRASES, GRITOS } from '../pulso/emociones.js'
import { texturaMarcador, texturaPapel } from '../pulso/lapiz.js'
import { rng } from '../piezas.js'

/**
 * "El pulso de Hermosillo": people gather around news and take the color of the
 * emotion each news item causes. Drawn like pencil on paper: white world, white
 * people, black outlines; the only color is the emotion (and the user's marker).
 *
 * - Small groups walk from news to news on their own (simulacion.js).
 * - A click or tap on the ground drops a red marker that works like a shout: people
 *   nearby are likely to hear it and rush there, people far away less so. The
 *   previous runners go back to their groups. Only the runners feel something: on
 *   arrival they take an emotion from the news under the marker (or the closest
 *   one). Everyone else stays neutral.
 * - News come and go (ciclo.js): a new one shows its title for a moment; after
 *   that the title only shows when the runners are near or the marker is in its
 *   circle. News nobody visits expire and another one takes their place.
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
const DISTANCIA_INICIAL = 48
/** How far the red ring of the shout spreads, and in how long */
const ONDA_RADIO = 9
const ONDA_DURACION = 0.9
/** How many people hear each shout */
const OYENTES = { web: 26, movil: 16 }
/** The runners count as "near" a news this far beyond its circle */
const RANGO_CERCA = 3.5

export default function crearPulsoHermosillo() {
  let THREE, camera, canvas, controls, sim, multitud, noticias, ciclo, capa, paleta, scene, marcador, onda
  let params = {}
  let ancho = 1
  let alto = 1
  let firmaNoticias = ''
  let reducido = false
  let oyentes = OYENTES.web
  let tiempoFrase = 0
  let tiempo = 0
  let marcadorPuesto = false
  let marcadorEdad = 0
  let ondaEdad = Infinity
  const quitar = []
  const random = rng(11)

  function firma(lista) {
    return (lista ?? []).map((n) => n.id).join('|')
  }

  /** New list of news: back to the queue, the map fills up again */
  function montarNoticias(lista) {
    const nuevas = ciclo.reiniciar(lista ?? [], tiempo, params.filtro ?? {})
    for (const k of nuevas) capa.escribir(k)
    sim.actualizarVisibilidad()
    firmaNoticias = firma(lista)
    if (reducido) sim.asentar()
  }

  /* ---------- the user's marker ---------- */

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

  /** Drops the marker and shouts from it (see sim.gritar) */
  function ponerMarcador(x, z) {
    const oyeron = sim.gritar(x, z, oyentes)
    const { x: gx, z: gz } = sim.guia // clamped to the map
    marcador.position.set(gx, 0.02, gz)
    marcador.visible = true
    marcadorPuesto = true
    marcadorEdad = 0
    onda.position.set(gx, 0.015, gz)
    ondaEdad = 0

    // A couple of the ones who heard it answer
    for (const i of oyeron.slice(0, 2)) {
      capa.decir(i, GRITOS[Math.floor(random() * GRITOS.length)], 'neutral', true)
    }
    if (reducido) sim.asentar(12) // no running animation: jump to the result
  }

  /** Slot k is "visited": the user's group is near it or the marker is inside its circle */
  let centroCorredores = null
  function cerca(k) {
    const p = noticias.puntos[k]
    if (!p.activa) return false
    if (marcadorPuesto) {
      const { x, z } = sim.guia
      if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.radio * p.radio) return true
    }
    if (!centroCorredores) return false
    if (k === sim.noticiaGrito) return true // the news the runners are reacting to
    const alcance = p.radio + RANGO_CERCA
    return (centroCorredores.x - p.x) ** 2 + (centroCorredores.z - p.z) ** 2 < alcance * alcance
  }

  /* ---------- clicks: drop the marker, plus a person (bubble) or a news circle ---------- */

  const v = { x: 0, y: 0 }
  function aPantalla(x, y, z) {
    const p = new THREE.Vector3(x, y, z).project(camera)
    v.x = ((p.x + 1) / 2) * ancho
    v.y = ((1 - p.y) / 2) * alto
    return p.z <= 1
  }

  function clic(px, py, clientX, clientY) {
    const punto = alSuelo(clientX, clientY)
    if (punto) ponerMarcador(punto.x, punto.z)

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

    // Empty ground closes the open news. Inside a circle only the group moves: the
    // news opens from its title card, which shows up once the group gets there.
    const dentro = punto && noticias.puntos.some((q) => q.visible && (punto.x - q.x) ** 2 + (punto.z - q.z) ** 2 < q.radio ** 2)
    if (!dentro) params.onSeleccion?.(null)
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
      oyentes = movil ? OYENTES.movil : OYENTES.web
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

      // Few news on the map at once, on more slots than that so they show up in different places
      const activasMax = movil ? 4 : 6
      noticias = crearNoticias(THREE, activasMax + 3)
      scene.add(noticias.grupo)

      sim = crearSimulacion(movil ? 64 : 100, { seed: 7, limite: noticias.limite })
      sim.setPuntos(noticias.puntos, { limite: noticias.limite, todos: true })
      multitud = crearMultitud(THREE, sim, paleta)
      scene.add(multitud.grupo)

      marcador = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: texturaMarcador(THREE), transparent: true, depthWrite: false })
      )
      marcador.visible = false
      marcador.renderOrder = 1
      scene.add(marcador)

      // The shout: a red ring that spreads from the marker and fades
      onda = new THREE.Mesh(
        new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xd8402b, transparent: true, opacity: 0, depthWrite: false })
      )
      onda.renderOrder = 1
      scene.add(onda)

      capa = crearCapa(THREE, canvas.parentElement, {
        onSeleccion: (id) => {
          // The card also sends the group to that news
          const p = noticias.puntos.find((q) => q.noticia?.id === id)
          if (p) ponerMarcador(p.x, p.z + Math.min(1.2, p.radio * 0.4))
          params.onSeleccion?.(id)
        },
      })
      capa.setNoticias(noticias.puntos)

      ciclo = crearCiclo(noticias, { activasMax, random, fijo: reducido })
      montarNoticias(params.noticias)

      camera.fov = 30
      camera.near = 0.5
      camera.far = 300
      camera.position.set(0, Math.sin(ELEVACION) * DISTANCIA_INICIAL, Math.cos(ELEVACION) * DISTANCIA_INICIAL)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()

      // Pan / zoom. Embedded on touch: no controls, so a finger scrolls the page.
      if (!(embebido && tactil)) {
        controls = new MapControls(camera, canvas)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.screenSpacePanning = false
        controls.minDistance = 10
        controls.maxDistance = 85
        controls.minPolarAngle = 0.25
        controls.maxPolarAngle = 1.15
        controls.target.set(0, 0, 0)
        controls.update()

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
        if (reducido) sim.asentar(20) // no animation: jump to the new arrangement
      }
      noticias.setSeleccion(params.seleccionId ?? null)
    },

    resize(w, h) {
      ancho = w
      alto = h
    },

    update(dt, t) {
      tiempo = t
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

      centroCorredores = sim.centroCorredores()

      // News coming and going
      const { nuevas, salieron, mostrar } = ciclo.update(dt, t, {
        cerca,
        seleccionId: params.seleccionId ?? null,
        filtro: params.filtro ?? {},
      })
      for (const k of nuevas) capa.escribir(k)
      if (salieron.length) sim.actualizarVisibilidad()
      capa.setEstado(params.seleccionId ?? null, mostrar)

      if (!reducido && dt > 0) {
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

      // Shout ring: spreads out fast and fades (instant with reduced motion: not shown)
      if (ondaEdad < ONDA_DURACION && !reducido) {
        ondaEdad += dt
        const avance = Math.min(1, ondaEdad / ONDA_DURACION)
        onda.scale.setScalar(0.5 + avance * ONDA_RADIO)
        onda.material.opacity = 0.7 * (1 - avance)
      } else {
        onda.material.opacity = 0
      }

      // Marker: pops in, then fades a bit once the runners have arrived
      if (marcador.visible) {
        marcadorEdad += dt
        const aparecer = Math.min(1, marcadorEdad / 0.25)
        marcador.scale.setScalar((1.5 - 0.5 * aparecer) * (1 + Math.sin(t * 4) * 0.04))
        const { x, z } = sim.guia
        const llego = centroCorredores && (centroCorredores.x - x) ** 2 + (centroCorredores.z - z) ** 2 < 2.25
        marcador.material.opacity += ((llego ? 0.45 : 1) - marcador.material.opacity) * Math.min(1, dt * 4)
      }

      noticias.update(t, reducido ? 1 : dt)
      multitud.actualizar()
      capa.actualizar(dt, camera, ancho, alto, sim, multitud.alturaCabeza)
    },

    dispose() {
      for (const fn of quitar) fn()
      controls?.dispose()
      capa?.dispose()
    },
  }
}
