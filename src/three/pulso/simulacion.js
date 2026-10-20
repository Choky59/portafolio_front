import { CLAVES_EMOCION, sortearEmocion } from './emociones.js'
import { rng } from '../piezas.js'

/**
 * Crowd behavior on the ground plane (x, z). No Three.js: plain arrays, so
 * hundreds of people cost microseconds per frame.
 *
 * Everyone walks in small independent groups of 2 to 4 that behave like a flock
 * (boids): each member seeks the group's destination, stays close to the others
 * (cohesion), matches their pace (alignment) and keeps its personal space
 * (separation).
 *
 * The groups spread over the news on the map by themselves: a group picks a news
 * mostly by relevance (distance matters only a little, and news that already have
 * more than their share of people are less likely), RUNS there and stays a while.
 * When its stay is over, sometimes it moves to another news; most of the time it
 * stays a while longer.
 *
 * With `fila`, everyone starts lined up in a grid that fills the given area (the
 * part of the ground the camera sees, see setFila), one spot per person (a group's
 * members side by side). When the news leave,
 * everyone runs back to its spot, and `enFila()` tells when they're all there (the
 * cycle waits for it before the next news). Without `fila` (the cover), a group
 * with nowhere to go just stands where it is.
 *
 * Each person feels something about its news: when it steps into the news' circle
 * it draws ONE emotion from that news' mix (neutral included, since that's what the
 * data says) and fades to its color. A controversial news ends up with a crowd of
 * several colors. When the group leaves for another news its members fade back to
 * neutral on the way, and draw again when they get to the new one.
 *
 * puntos: [{ x, z, radio, peso, visible, noticia }]
 */
const VEL_MAX = 1.5
const RADIO_SEPARACION = 0.62
const CELDA = 1
const FUNDIDO = 0.9 // seconds to reach (or lose) the emotion color
const COHESION = 0.8
const ALINEACION = 0.6
const LLEGADA = 0.6 // a person "is at" its news this far beyond the circle
const DISTANCIA = 20 // every 20 units farther, the news is half as likely
const ESPERA_SIN_NOTICIA = 2 // seconds before looking again when there's nowhere to go
const CARRERA = 2.4 // on the way to their news everyone runs, this much faster than walking
const FORMADO = 0.12 // "at its grid spot" within this distance (rows look straight)

/**
 * estancia: [min, max] seconds a group stays at a news before deciding again
 * cambiar: chance of moving to another news when the stay is over (else it stays)
 * fila: use the starting grid (until setFila gives it an area, a small square in the center)
 * apretar: { emotionKey: 0–1 }, people feeling it stand that much closer to the center
 *   of their news (fear huddles them together)
 */
export function crearSimulacion(n, { seed = 1, limite = 30, estancia = [25, 60], cambiar = 0.3, fila = false, apretar = {} } = {}) {
  const random = rng(seed)
  const apretarPor = CLAVES_EMOCION.map((c) => apretar[c] ?? 0)

  const x = new Float32Array(n)
  const z = new Float32Array(n)
  const vx = new Float32Array(n)
  const vz = new Float32Array(n)
  const yaw = new Float32Array(n)
  const fase = new Float32Array(n)
  const rapidez = new Float32Array(n)
  /** News each person is heading to (its group's), -1 = none */
  const objetivo = new Int16Array(n).fill(-1)
  /** Formation offset inside the group */
  const offX = new Float32Array(n)
  const offZ = new Float32Array(n)
  /** Index in CLAVES_EMOCION, -1 = none */
  const emocion = new Int8Array(n).fill(-1)
  /** News the current emotion came from */
  const emocionDe = new Int16Array(n).fill(-1)
  /** 0 = neutral color, 1 = full emotion color */
  const mezcla = new Float32Array(n)
  const escala = new Float32Array(n)
  const pelo = new Uint8Array(n)
  const grupoDe = new Int16Array(n).fill(-1)
  /** Each person's spot in the starting grid (rows facing the camera) */
  const filaX = new Float32Array(n)
  const filaZ = new Float32Array(n)

  /**
   * Spreads the grid over a trapezoid centered on x = 0, from z0 (half width medio0)
   * to z1 (half width medio1): what the camera sees of the ground. Every row spans the
   * width at its depth with the same number of columns, so on screen the spots look
   * evenly spaced and fill the view. The last row is centered.
   */
  function calcularFila({ z0, z1, medio0, medio1 }) {
    const alto = z1 - z0
    const anchoMedio = medio0 + medio1
    const cols = Math.max(1, Math.round(Math.sqrt((n * anchoMedio) / alto)))
    const filas = Math.ceil(n / cols)
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols)
      const t = (r + 0.5) / filas
      const pasoX = (2 * (medio0 + (medio1 - medio0) * t)) / cols
      const enFilaR = r === filas - 1 ? n - r * cols : cols
      filaX[i] = ((i % cols) - (enFilaR - 1) / 2) * pasoX
      filaZ[i] = z0 + t * alto
    }
  }
  const lado = Math.ceil(Math.sqrt(n)) * 0.45
  calcularFila({ z0: -lado, z1: lado, medio0: lado, medio1: lado })

  let puntos = []
  let lim = limite

  // Spatial hash (linked lists per cell), rebuilt every step
  let columnas = 0
  let cabeza = new Int32Array(0)
  const siguiente = new Int32Array(n)

  for (let i = 0; i < n; i++) {
    yaw[i] = fila ? 0 : random() * Math.PI * 2 // in the grid, facing the camera
    fase[i] = random() * Math.PI * 2
    escala[i] = 0.9 + random() * 0.2
    pelo[i] = random() < 0.55 ? 1 : 0
  }

  // Groups of 2 to 4, starting together somewhere on the map
  const grupos = []
  for (let i = 0; i < n; ) {
    const restantes = n - i
    // never leave a single person alone at the end
    let tamano = Math.min(restantes, 2 + Math.floor(random() * 3))
    if (restantes - tamano === 1) tamano = tamano === 4 ? 3 : tamano + 1
    const g = {
      miembros: [],
      objetivo: -1,
      anterior: -1,
      tx: 0,
      tz: 0,
      parado: false,
      timer: random() * 2, // first destination comes at a random moment
      velocidad: 0.75 + random() * 0.3, // each group walks at its own pace
      cx: 0, cz: 0, vx: 0, vz: 0,
    }
    const inicioX = (random() * 2 - 1) * lim * 0.7
    const inicioZ = (random() * 2 - 1) * lim * 0.7
    for (let m = 0; m < tamano; m++, i++) {
      const a = m * 2.39996 + random()
      const r = m === 0 ? 0 : 0.6
      offX[i] = Math.cos(a) * r
      offZ[i] = Math.sin(a) * r
      x[i] = fila ? filaX[i] : inicioX + offX[i]
      z[i] = fila ? filaZ[i] : inicioZ + offZ[i]
      grupoDe[i] = grupos.length
      g.miembros.push(i)
    }
    g.tx = g.cx = inicioX
    g.tz = g.cz = inicioZ
    grupos.push(g)
  }

  const duracionEstancia = () => estancia[0] + random() * (estancia[1] - estancia[0])

  /** Sends group g to news k: a point inside its circle (not the center, so groups share it) */
  function irA(g, k) {
    const p = puntos[k]
    const angulo = random() * Math.PI * 2
    const radio = p.radio * 0.6 * Math.sqrt(random())
    g.anterior = g.objetivo
    g.objetivo = k
    g.tx = p.x + Math.cos(angulo) * radio
    g.tz = p.z + Math.sin(angulo) * radio
    g.parado = false
    g.timer = Infinity // set when it arrives
    for (const i of g.miembros) objetivo[i] = k
  }

  /** Nowhere to go: back to the grid (or wait where it is) and look again in a moment */
  function esperar(g) {
    g.anterior = g.objetivo
    g.objetivo = -1
    g.tx = g.cx
    g.tz = g.cz
    g.parado = true
    g.timer = ESPERA_SIN_NOTICIA
    for (const i of g.miembros) objetivo[i] = -1
  }

  /**
   * Next news for a group, mostly by relevance. Distance counts a little, a news
   * with more people than its share is less likely, and it doesn't go back to the
   * one it just left (when there are others).
   */
  function elegirNoticia(g) {
    const visibles = puntos.filter((p) => p.visible)
    const pesoTotal = visibles.reduce((s, p) => s + p.peso, 0)
    // How many groups go to each news now, and how many its relevance deserves
    const carga = puntos.map(() => 0)
    for (const o of grupos) if (o !== g && o.objetivo >= 0) carga[o.objetivo]++

    let total = 0
    const pesos = puntos.map((p, k) => {
      if (!p.visible || k === g.objetivo || (k === g.anterior && visibles.length > 2)) return 0
      const d = Math.hypot(p.x - g.cx, p.z - g.cz)
      const justo = Math.max(0.5, (grupos.length * p.peso) / pesoTotal)
      const w = (p.peso / (1 + d / DISTANCIA)) * (justo / (justo + carga[k]))
      total += w
      return w
    })

    if (total === 0) {
      // Its current news is the only one left: stay
      if (g.objetivo >= 0 && puntos[g.objetivo]?.visible) {
        g.parado = true
        g.timer = duracionEstancia()
        return
      }
      esperar(g)
      return
    }

    let r = random() * total
    let elegido = 0
    for (let k = 0; k < pesos.length; k++) {
      if (!pesos[k]) continue
      r -= pesos[k]
      elegido = k
      if (r <= 0) break
    }
    irA(g, elegido)
  }

  function reconstruirHash() {
    columnas = Math.ceil((lim * 2) / CELDA) + 1
    const total = columnas * columnas
    if (cabeza.length !== total) cabeza = new Int32Array(total)
    cabeza.fill(-1)
    for (let i = 0; i < n; i++) {
      const c = celda(x[i], z[i])
      siguiente[i] = cabeza[c]
      cabeza[c] = i
    }
  }

  function celda(px, pz) {
    const cx = Math.min(columnas - 1, Math.max(0, Math.floor((px + lim) / CELDA)))
    const cz = Math.min(columnas - 1, Math.max(0, Math.floor((pz + lim) / CELDA)))
    return cz * columnas + cx
  }

  /** Each group's centroid and average velocity (cohesion, alignment); arrivals and stays */
  function actualizarGrupos(dt) {
    for (const g of grupos) {
      let cx = 0
      let cz = 0
      let gvx = 0
      let gvz = 0
      for (const i of g.miembros) {
        cx += x[i]
        cz += z[i]
        gvx += vx[i]
        gvz += vz[i]
      }
      const m = g.miembros.length
      g.cx = cx / m
      g.cz = cz / m
      g.vx = gvx / m
      g.vz = gvz / m

      if (!g.parado && g.objetivo >= 0) {
        const dx = g.tx - g.cx
        const dz = g.tz - g.cz
        if (dx * dx + dz * dz < 1) {
          g.parado = true
          g.timer = duracionEstancia()
        }
      }
      g.timer -= dt
      if (g.timer > 0) continue
      // Stay over: sometimes it moves on, most of the time it stays a while longer
      if (g.objetivo >= 0 && puntos[g.objetivo]?.visible && random() >= cambiar) g.timer = duracionEstancia()
      else elegirNoticia(g)
    }
  }

  /** Returns the people that just reached their news and felt something (for the speech bubbles) */
  function paso(dt) {
    const llegadas = []
    if (dt <= 0) return llegadas
    reconstruirHash()
    actualizarGrupos(dt)

    const suavizado = Math.min(1, dt * 4)

    for (let i = 0; i < n; i++) {
      const g = grupos[grupoDe[i]]

      // Seek with arrival: its spot in the group's destination, or its own grid spot
      const aFila = fila && g.objetivo < 0
      let destinoX = aFila ? filaX[i] : g.tx + offX[i]
      let destinoZ = aFila ? filaZ[i] : g.tz + offZ[i]
      // Huddled (fear): its spot moves toward the center of its news as the emotion shows
      const apretado = emocion[i] >= 0 && emocionDe[i] === objetivo[i] ? apretarPor[emocion[i]] * mezcla[i] : 0
      if (apretado) {
        const q = puntos[objetivo[i]]
        destinoX += (q.x - destinoX) * apretado
        destinoZ += (q.z - destinoZ) * apretado
      }
      const dx = destinoX - x[i]
      const dz = destinoZ - z[i]
      const d = Math.sqrt(dx * dx + dz * dz)
      // Runs until it's at its news (or back in line); once there it just shuffles into its spot
      const corriendo = aFila
        ? d > 0.4
        : !g.parado && g.objetivo >= 0 && objetivo[i] >= 0 && !(emocionDe[i] === objetivo[i] && emocion[i] >= 0)
      const vMax = VEL_MAX * g.velocidad * (corriendo ? CARRERA : 1)
      let deseadaX = 0
      let deseadaZ = 0
      if (d > 0.08) {
        const v = vMax * Math.min(1, d / 1.4)
        deseadaX = (dx / d) * v
        deseadaZ = (dz / d) * v
      }

      // Flocking inside the group while walking: stay together and keep the same pace
      if (!aFila && !g.parado && g.miembros.length > 1) {
        const hx = g.cx - x[i]
        const hz = g.cz - z[i]
        if (hx * hx + hz * hz > 0.36) {
          deseadaX += hx * COHESION
          deseadaZ += hz * COHESION
        }
        deseadaX += (g.vx - vx[i]) * ALINEACION
        deseadaZ += (g.vz - vz[i]) * ALINEACION
      }

      // Separation from everyone nearby (3x3 cells)
      let empujeX = 0
      let empujeZ = 0
      const cx = Math.floor((x[i] + lim) / CELDA)
      const cz = Math.floor((z[i] + lim) / CELDA)
      for (let oz = -1; oz <= 1; oz++) {
        const renglon = cz + oz
        if (renglon < 0 || renglon >= columnas) continue
        for (let ox = -1; ox <= 1; ox++) {
          const col = cx + ox
          if (col < 0 || col >= columnas) continue
          for (let j = cabeza[renglon * columnas + col]; j !== -1; j = siguiente[j]) {
            if (j === i) continue
            const sx = x[i] - x[j]
            const sz = z[i] - z[j]
            const s2 = sx * sx + sz * sz
            if (s2 > RADIO_SEPARACION * RADIO_SEPARACION || s2 < 1e-6) continue
            const s = Math.sqrt(s2)
            const fuerza = ((RADIO_SEPARACION - s) / RADIO_SEPARACION) * 2.4
            empujeX += (sx / s) * fuerza
            empujeZ += (sz / s) * fuerza
          }
        }
      }

      vx[i] += (deseadaX + empujeX - vx[i]) * suavizado
      vz[i] += (deseadaZ + empujeZ - vz[i]) * suavizado
      x[i] = Math.max(-lim, Math.min(lim, x[i] + vx[i] * dt))
      z[i] = Math.max(-lim, Math.min(lim, z[i] + vz[i] * dt))

      const vel = Math.sqrt(vx[i] * vx[i] + vz[i] * vz[i])
      rapidez[i] = vel
      fase[i] += vel * dt * 8

      // Face where it walks; once still, face its news (or the camera, in line)
      const k = objetivo[i]
      const p = k >= 0 ? puntos[k] : null
      let yawDeseado = null
      if (vel > 0.2) yawDeseado = Math.atan2(vx[i], vz[i])
      else if (p) yawDeseado = Math.atan2(p.x - x[i], p.z - z[i])
      else if (aFila) yawDeseado = 0
      if (yawDeseado !== null) {
        let delta = yawDeseado - yaw[i]
        delta = Math.atan2(Math.sin(delta), Math.cos(delta))
        yaw[i] += delta * Math.min(1, dt * 6)
      }

      // Emotion: drawn on stepping into its news' circle and faded in; faded out on
      // the way to another news (or when its news goes away), then cleared
      const enSuNoticia = p?.visible && (p.x - x[i]) ** 2 + (p.z - z[i]) ** 2 < (p.radio + LLEGADA) ** 2
      if (emocion[i] >= 0 && emocionDe[i] === k && p?.visible) {
        if (enSuNoticia) mezcla[i] = Math.min(1, mezcla[i] + dt / FUNDIDO)
      } else if (emocion[i] >= 0) {
        mezcla[i] = Math.max(0, mezcla[i] - dt / FUNDIDO)
        if (mezcla[i] === 0) {
          emocion[i] = -1
          emocionDe[i] = -1
        }
      } else if (enSuNoticia) {
        emocion[i] = CLAVES_EMOCION.indexOf(sortearEmocion(p.noticia, random))
        emocionDe[i] = k
        llegadas.push(i)
      }
    }

    return llegadas
  }

  return {
    n,
    x, z, yaw, fase, rapidez, emocion, mezcla, escala, pelo, objetivo, grupoDe,
    get limite() {
      return lim
    },

    /**
     * New meeting points. With `todos` every group picks again (new set of news);
     * otherwise only groups whose news disappeared or got hidden.
     */
    setPuntos(nuevos, { limite: nuevoLimite = lim, todos = false } = {}) {
      puntos = nuevos
      lim = nuevoLimite
      for (const g of grupos) {
        const k = g.objetivo
        if (todos || k >= puntos.length || (k >= 0 && !puntos[k].visible)) {
          if (todos || k >= puntos.length) {
            g.anterior = -1
            g.objetivo = -1
          }
          elegirNoticia(g)
        }
      }
    },

    /** Hidden or gone news: their groups leave for another one; groups with nowhere to go look again */
    actualizarVisibilidad() {
      for (const g of grupos) {
        if (g.objetivo < 0 || !puntos[g.objetivo]?.visible) elegirNoticia(g)
      }
    },

    paso,

    /**
     * Area the grid fills on the ground, { z0, z1, medio0, medio1 } (see calcularFila).
     * The map grows to hold it.
     * With `mover` everyone jumps to its spot right away (before the first frame).
     */
    setFila(area, { mover = false } = {}) {
      if (!fila) return
      calcularFila(area)
      lim = Math.max(lim, area.medio0, area.medio1, Math.abs(area.z0), Math.abs(area.z1))
      if (!mover) return
      for (let i = 0; i < n; i++) {
        x[i] = filaX[i]
        z[i] = filaZ[i]
        vx[i] = 0
        vz[i] = 0
      }
    },

    /** Everyone is back at its grid spot (always true without a grid) */
    enFila() {
      if (!fila) return true
      for (let i = 0; i < n; i++) {
        if (objetivo[i] >= 0) return false
        if ((x[i] - filaX[i]) ** 2 + (z[i] - filaZ[i]) ** 2 > FORMADO * FORMADO) return false
      }
      return true
    },

    /** Runs the simulation without drawing (reduced motion: finished frame) */
    asentar(segundos = 40, dt = 1 / 20) {
      for (let s = 0; s < segundos / dt; s++) paso(dt)
      for (let i = 0; i < n; i++) {
        vx[i] = 0
        vz[i] = 0
        rapidez[i] = 0
        // Finished frame: whoever is at its news shows its color, anyone still on the way none
        if (emocion[i] < 0) continue
        if (emocionDe[i] === objetivo[i]) mezcla[i] = 1
        else {
          mezcla[i] = 0
          emocion[i] = -1
          emocionDe[i] = -1
        }
      }
    },

    /** Emotion key of a person, or null */
    claveEmocion(i) {
      return emocion[i] >= 0 ? CLAVES_EMOCION[emocion[i]] : null
    },
  }
}
