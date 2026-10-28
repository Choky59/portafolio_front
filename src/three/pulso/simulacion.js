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
 * it draws ONE emotion from that news' mix (never neutral: everyone who gets to a
 * news reacts) and fades to its color. A controversial news ends up with a crowd of
 * several colors. When the group leaves for another news its members fade back to
 * no color on the way, and draw again when they get to the new one.
 *
 * At its news a group doesn't stand still: its members make a small ring facing each
 * other (chatting), glance at the news now and then, sway a little, and every few
 * seconds the group strolls to another spot of the circle.
 *
 * Someone on the way to another news (still with no emotion) who cuts through a news
 * opens a lane: the people near its path ahead step to the side before it gets there,
 * then walk back to their spot. Some of the closest complain (`quejas`).
 *
 * puntos: [{ x, z, radio, peso, visible, noticia }]
 */
const VEL_MAX = 1.5
const RADIO_SEPARACION = 0.62
const DISTANCIA_MIN = 0.5 * 1.5 // two people are never closer than this (no one inside another)
const PASADAS_SEPARAR = 3
const PASEO = [6, 14] // seconds a group chats in one spot of its news before strolling to another
const MECER = 0.14 // how far people sway around their spot while chatting
// Someone cutting through a news (no emotion yet) on the way to its own: the people there
// step out of its path ahead of time, then walk back to their spot on their own
const CARRIL = 1.3 // people closer than this to its path move aside...
const ADELANTE = 4.5 // ...along this much of the path ahead of it
const CARRIL_VEL = 2.2 // ...at most this fast (a calm step aside, not a shove)
const RODEO = 1.2 // on the way, people go around other news' circles with this much room
const VEL_TOPE = 7.5 // nobody moves faster than this in one step (shoves + separating settle over a few frames)
const QUEJA_CADA = 5 // seconds before the same person complains again
const CELDA = 1
const FUNDIDO = 0.9 // seconds to reach (or lose) the emotion color
const COHESION = 0.8
const ALINEACION = 0.6
const LLEGADA = 0.6 // a person "is at" its news this far beyond the circle
const EN_SU_LUGAR = 1.2 // ...or this close to its spot in the group (crowded groups spill past the circle)
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
  /** 0 = no color yet (white), 1 = full emotion color */
  const mezcla = new Float32Array(n)
  const escala = new Float32Array(n)
  const pelo = new Uint8Array(n)
  const grupoDe = new Int16Array(n).fill(-1)
  /** Place in its group (0..size-1), for the chatting ring */
  const lugar = new Uint8Array(n)
  /** Position at the start of the step: the real velocity is measured after separating people */
  const antesX = new Float32Array(n)
  const antesZ = new Float32Array(n)
  /** Seconds until each person can complain again, and who complained this step */
  const queja = new Float32Array(n)
  /** Shove this step (several people cutting through add up, capped) */
  const apartaX = new Float32Array(n)
  const apartaZ = new Float32Array(n)
  const quejas = []
  let tiempo = 0
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
      paseo: 0, // seconds left in its current spot of the news
      giro: random() * Math.PI * 2, // how its chatting ring is turned
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
      lugar[i] = m
      g.miembros.push(i)
    }
    g.tx = g.cx = inicioX
    g.tz = g.cz = inicioZ
    grupos.push(g)
  }

  const duracionEstancia = () => estancia[0] + random() * (estancia[1] - estancia[0])

  /** A random spot inside news p's circle (not the center, so groups share it) */
  function lugarEn(g, p) {
    const angulo = random() * Math.PI * 2
    const radio = p.radio * 0.6 * Math.sqrt(random())
    g.tx = p.x + Math.cos(angulo) * radio
    g.tz = p.z + Math.sin(angulo) * radio
  }

  /** A short stroll: a spot near where the group is, still inside its news' circle */
  function pasear(g, p) {
    const angulo = random() * Math.PI * 2
    const paso = 0.8 + random() * 1.2
    let tx = g.tx + Math.cos(angulo) * paso
    let tz = g.tz + Math.sin(angulo) * paso
    const lejos = Math.hypot(tx - p.x, tz - p.z)
    const max = p.radio * 0.7
    if (lejos > max) {
      tx = p.x + ((tx - p.x) / lejos) * max
      tz = p.z + ((tz - p.z) / lejos) * max
    }
    g.tx = tx
    g.tz = tz
  }

  /** Sends group g to news k */
  function irA(g, k) {
    const p = puntos[k]
    g.anterior = g.objetivo
    g.objetivo = k
    lugarEn(g, p)
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
          g.paseo = PASEO[0] + random() * (PASEO[1] - PASEO[0])
        }
      }
      // Chatting at its news: now and then the group strolls to another spot of the circle
      if (g.parado && g.objetivo >= 0 && puntos[g.objetivo]?.visible) {
        g.paseo -= dt
        if (g.paseo <= 0) {
          pasear(g, puntos[g.objetivo])
          g.giro = random() * Math.PI * 2
          g.paseo = PASEO[0] + random() * (PASEO[1] - PASEO[0])
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
    tiempo += dt
    antesX.set(x)
    antesZ.set(z)
    quejas.length = 0

    const suavizado = Math.min(1, dt * 4)

    for (let i = 0; i < n; i++) {
      const g = grupos[grupoDe[i]]

      // Seek with arrival: its spot in the group's destination, or its own grid spot
      const aFila = fila && g.objetivo < 0
      let destinoX = aFila ? filaX[i] : g.tx + offX[i]
      let destinoZ = aFila ? filaZ[i] : g.tz + offZ[i]
      // Chatting: a small ring facing each other instead of the walking formation, swaying a little
      const charla = !aFila && g.parado && g.objetivo >= 0
      const m = g.miembros.length
      if (charla && m > 1) {
        const a = g.giro + (lugar[i] / m) * Math.PI * 2
        const r = Math.max(0.32, DISTANCIA_MIN / (2 * Math.sin(Math.PI / m)) + 0.06)
        destinoX = g.tx + Math.cos(a) * r
        destinoZ = g.tz + Math.sin(a) * r
      }
      if (charla) {
        destinoX += Math.sin(tiempo * 0.7 + fase[i]) * MECER
        destinoZ += Math.cos(tiempo * 0.53 + fase[i] * 1.3) * MECER
      }
      // On the way: around the other news' crowds, not through them
      if (!aFila && !charla && objetivo[i] >= 0) {
        rodear(i, destinoX, destinoZ)
        destinoX = desvio.x
        destinoZ = desvio.z
      }
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
      const vMax = VEL_MAX * g.velocidad * (corriendo ? CARRERA : charla ? 0.45 : 1) // strolls are slow
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
      // Chatting in a group: face the others, glancing at the news every now and then
      else if (p && charla && m > 1 && Math.sin(tiempo * 0.35 + fase[i] * 2) < 0.55)
        yawDeseado = Math.atan2(g.tx - x[i], g.tz - z[i])
      else if (p) yawDeseado = Math.atan2(p.x - x[i], p.z - z[i])
      else if (aFila) yawDeseado = 0
      if (yawDeseado !== null) {
        let delta = yawDeseado - yaw[i]
        delta = Math.atan2(Math.sin(delta), Math.cos(delta))
        yaw[i] += delta * Math.min(1, dt * 6)
      }

      // Emotion: drawn on stepping into its news' circle and faded in; faded out on
      // the way to another news (or when its news goes away), then cleared
      const enSuNoticia =
        p?.visible && ((p.x - x[i]) ** 2 + (p.z - z[i]) ** 2 < (p.radio + LLEGADA) ** 2 || (g.objetivo === k && d < EN_SU_LUGAR))
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

    abrirPaso(dt)
    // A few passes: fixing one pair can push someone into a third person
    for (let pasada = 0; pasada < PASADAS_SEPARAR; pasada++) separar()
    // What they really moved: someone pushing into a full spot doesn't walk in place
    const tope = VEL_TOPE * dt
    for (let i = 0; i < n; i++) {
      const mx = x[i] - antesX[i]
      const mz = z[i] - antesZ[i]
      const m = Math.hypot(mx, mz)
      if (m > tope) {
        x[i] = antesX[i] + (mx / m) * tope
        z[i] = antesZ[i] + (mz / m) * tope
      }
      const realX = (x[i] - antesX[i]) / dt
      const realZ = (z[i] - antesZ[i]) / dt
      // Their own velocity leaves out the step aside, or it would build up frame after frame
      vx[i] = realX - apartaX[i]
      vz[i] = realZ - apartaZ[i]
      const real = Math.sqrt(realX * realX + realZ * realZ)
      fase[i] += (real - rapidez[i]) * dt * 8
      rapidez[i] = real
    }
    return llegadas
  }

  /** Whoever cuts through a news (on its way, no emotion yet) opens a lane along its path ahead */
  function abrirPaso(dt) {
    reconstruirHash()
    for (let i = 0; i < n; i++) queja[i] = Math.max(0, queja[i] - dt)
    apartaX.fill(0)
    apartaZ.fill(0)
    for (let j = 0; j < n; j++) {
      if (emocion[j] >= 0 || objetivo[j] < 0 || rapidez[j] < 0.4) continue
      // Its path: straight to its spot at its news, up to ADELANTE ahead
      const g = grupos[grupoDe[j]]
      const hx = g.tx + offX[j] - x[j]
      const hz = g.tz + offZ[j] - z[j]
      const total = Math.hypot(hx, hz)
      if (total < 0.5) continue
      const dirX = hx / total
      const dirZ = hz / total
      const largo = Math.min(ADELANTE, total)
      // Cells around the path segment
      const fx = x[j] + dirX * largo
      const fz = z[j] + dirZ * largo
      const c0 = Math.max(0, Math.floor((Math.min(x[j], fx) - CARRIL + lim) / CELDA))
      const c1 = Math.min(columnas - 1, Math.floor((Math.max(x[j], fx) + CARRIL + lim) / CELDA))
      const r0 = Math.max(0, Math.floor((Math.min(z[j], fz) - CARRIL + lim) / CELDA))
      const r1 = Math.min(columnas - 1, Math.floor((Math.max(z[j], fz) + CARRIL + lim) / CELDA))
      for (let renglon = r0; renglon <= r1; renglon++) {
        for (let col = c0; col <= c1; col++) {
          for (let i = cabeza[renglon * columnas + col]; i !== -1; i = siguiente[i]) {
            // Only people already at their news (a different one), feeling something
            if (emocion[i] < 0 || emocionDe[i] !== objetivo[i] || objetivo[i] === objetivo[j]) continue
            if (!grupos[grupoDe[i]].parado) continue
            const sx = x[i] - x[j]
            const sz = z[i] - z[j]
            const a = sx * dirX + sz * dirZ // along the path (negative: already behind it)
            if (a < -0.3 || a > largo) continue
            const h = sx * -dirZ + sz * dirX // to the side (signed)
            const lejos = Math.abs(h)
            if (lejos >= CARRIL) continue
            // Out to the side it's already on; the closer to the path (and to it), the quicker
            const lado = h > 0.02 ? 1 : h < -0.02 ? -1 : i % 2 ? 1 : -1
            const k = (1 - lejos / CARRIL) * (1 - (0.5 * Math.max(0, a)) / ADELANTE) * CARRIL_VEL
            apartaX[i] += -dirZ * lado * k
            apartaZ[i] += dirX * lado * k
            if (queja[i] === 0 && a < 1 && lejos < 0.7) {
              quejas.push(i)
              queja[i] = QUEJA_CADA
            }
          }
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const v = Math.hypot(apartaX[i], apartaZ[i])
      if (v === 0) continue
      const k = Math.min(v, CARRIL_VEL) / v
      apartaX[i] *= k
      apartaZ[i] *= k
      x[i] = Math.max(-lim, Math.min(lim, x[i] + apartaX[i] * dt))
      z[i] = Math.max(-lim, Math.min(lim, z[i] + apartaZ[i] * dt))
    }
  }

  /**
   * Where person i should head to reach (dx, dz) without crossing another news' circle:
   * the first circle in the way gives a waypoint beside it (on the side the person
   * already is). A circle the person is inside of (the one it's leaving) doesn't count.
   */
  const desvio = { x: 0, z: 0 }
  function rodear(i, dx, dz) {
    desvio.x = dx
    desvio.z = dz
    const hx = dx - x[i]
    const hz = dz - z[i]
    const largo = Math.hypot(hx, hz)
    if (largo < 0.5) return
    const ux = hx / largo
    const uz = hz / largo
    let mejor = Infinity
    for (let k = 0; k < puntos.length; k++) {
      const q = puntos[k]
      if (!q?.visible || k === objetivo[i]) continue
      const qx = q.x - x[i]
      const qz = q.z - z[i]
      const libre = q.radio + RODEO
      if (qx * qx + qz * qz < q.radio * q.radio) continue // leaving it
      const a = qx * ux + qz * uz // along the way
      if (a <= 0 || a - libre > largo || a >= mejor) continue
      const h = qx * -uz + qz * ux // to the side (signed)
      if (Math.abs(h) >= libre) continue
      // Beside the circle, on the person's side of its center
      const lado = h > 0 ? -1 : 1
      mejor = a
      desvio.x = q.x + -uz * lado * libre
      desvio.z = q.z + ux * lado * libre
    }
  }

  /** On the way to its news with no emotion yet (the one who opens a lane) */
  const pasando = (i) => emocion[i] < 0 && objetivo[i] >= 0

  /**
   * Hard minimum distance: the soft push above can lose against everyone walking to
   * the same spot, so pairs still closer than DISTANCIA_MIN are moved apart (half each)
   */
  function separar() {
    reconstruirHash()
    const min2 = DISTANCIA_MIN * DISTANCIA_MIN
    for (let i = 0; i < n; i++) {
      const cx = Math.floor((x[i] + lim) / CELDA)
      const cz = Math.floor((z[i] + lim) / CELDA)
      for (let oz = -1; oz <= 1; oz++) {
        const renglon = cz + oz
        if (renglon < 0 || renglon >= columnas) continue
        for (let ox = -1; ox <= 1; ox++) {
          const col = cx + ox
          if (col < 0 || col >= columnas) continue
          for (let j = cabeza[renglon * columnas + col]; j !== -1; j = siguiente[j]) {
            if (j <= i) continue
            let sx = x[i] - x[j]
            let sz = z[i] - z[j]
            const s2 = sx * sx + sz * sz
            if (s2 >= min2) continue
            let s = Math.sqrt(s2)
            if (s < 1e-4) {
              // Same spot: any direction
              const a = random() * Math.PI * 2
              sx = Math.cos(a)
              sz = Math.sin(a)
              s = 1
            } else {
              sx /= s
              sz /= s
            }
            // Someone passing through goes around the people standing there (it takes most of the fix)
            const falta = DISTANCIA_MIN - Math.min(s, DISTANCIA_MIN)
            const pi = pasando(i)
            const pj = pasando(j)
            const parteI = pi === pj ? 0.5 : pi ? 0.7 : 0.3
            x[i] = Math.max(-lim, Math.min(lim, x[i] + sx * falta * parteI))
            z[i] = Math.max(-lim, Math.min(lim, z[i] + sz * falta * parteI))
            x[j] = Math.max(-lim, Math.min(lim, x[j] - sx * falta * (1 - parteI)))
            z[j] = Math.max(-lim, Math.min(lim, z[j] - sz * falta * (1 - parteI)))
          }
        }
      }
    }
  }

  return {
    n,
    /** People who had to step aside this step (the last `paso`) */
    quejas,
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
