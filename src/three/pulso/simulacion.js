import { CLAVES_EMOCION, sortearEmocion } from './emociones.js'
import { rng } from '../piezas.js'

/**
 * Crowd behavior on the ground plane (x, z). No Three.js: plain arrays, so
 * hundreds of people cost microseconds per frame.
 *
 * Everyone walks in small independent groups of 2 to 4 that behave like a flock
 * (boids): each member seeks the group's destination, stays close to the others
 * (cohesion), matches their pace (alignment) and keeps its personal space
 * (separation). A group walks to a news item, stays a while, then heads to another
 * one, preferring close and relevant news.
 *
 * The user's marker is a shout (gritar): a fixed number of people hear it, and the
 * closer someone is, the more likely they're one of them. Those who hear it leave their group and rush to the marker like they
 * can't wait to see the news: faster than everyone, weaving and jostling, and still
 * fidgeting once there. The next shout sends the previous runners back to their
 * groups (and so does waiting too long).
 *
 * Runners are like magnets with the same pole: everyone else is pushed away from
 * them, and while anyone is running the groups keep away from the marker (they
 * don't pick news next to it, and leave the ones they were heading to).
 *
 * Only runners feel something, and only if the marker is on a news: the moment a
 * person hears the shout it draws ONE emotion from that news' distribution and
 * starts fading to its color while it runs. A shout on empty ground still makes
 * people run, but they stay neutral. When a runner stops running (or the news under
 * the marker goes away) it fades back to neutral. Groups walking around always stay
 * neutral.
 *
 * puntos: [{ x, z, radio, peso, visible, noticia }]
 */
const VEL_MAX = 1.5
const RADIO_SEPARACION = 0.62
const CELDA = 1
const FUNDIDO = 0.9 // seconds to reach the emotion color
const COHESION = 0.8
const ALINEACION = 0.6
// Shout: who hears it, and how the runners move
const ALCANCE_GRITO = 4 // every 4 units farther, ~1/3 the chance of being one who hears it
const TIEMPO_CORRIENDO = 35 // seconds at the marker before going back to the group
const PRISA = 2.3 // how much faster they go
const ZIGZAG = 0.9 // wobble of their spot, in units
const EMPUJONES = 3.5 // random kicks while running
// Repulsion: runners push everyone else away, and the marker keeps groups off
const RADIO_REPULSION = 2.4
const FUERZA_REPULSION = 4
const RADIO_MARCADOR = 3.5
const FUERZA_MARCADOR = 3
const EVITAR_MARCADOR = 2.5 // groups skip news whose circle is this close to the marker

export function crearSimulacion(n, { seed = 1, limite = 30 } = {}) {
  const random = rng(seed)
  let guiaX = 0
  let guiaZ = 0

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
  /** Runners: heard the last shout. Their spot around the marker, and until when they run */
  const corre = new Uint8Array(n)
  const offRX = new Float32Array(n)
  const offRZ = new Float32Array(n)
  const correHasta = new Float32Array(n)
  /** Runner already reached its spot (its arrival was reported, for the bubbles) */
  const llegoAlGrito = new Uint8Array(n)
  /** Each runner's own wobble rhythm */
  const ruidoF = new Float32Array(n)
  const ruidoP = new Float32Array(n)
  /** Index in CLAVES_EMOCION, -1 = none */
  const emocion = new Int8Array(n).fill(-1)
  /** News the current emotion came from */
  const emocionDe = new Int16Array(n).fill(-1)
  /** 0 = neutral color, 1 = full emotion color */
  const mezcla = new Float32Array(n)
  const escala = new Float32Array(n)
  const pelo = new Uint8Array(n)
  const grupoDe = new Int16Array(n).fill(-1)

  let puntos = []
  let lim = limite
  let reloj = 0
  /** News under the marker of the last shout, -1 = none (empty ground) */
  let noticiaGrito = -1

  // Spatial hash (linked lists per cell), rebuilt every step
  let columnas = 0
  let cabeza = new Int32Array(0)
  const siguiente = new Int32Array(n)

  for (let i = 0; i < n; i++) {
    yaw[i] = random() * Math.PI * 2
    fase[i] = random() * Math.PI * 2
    escala[i] = 0.9 + random() * 0.2
    ruidoF[i] = 1.2 + random() * 1.8
    ruidoP[i] = random() * Math.PI * 2
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
      timer: random() * 4, // first destination comes at a random moment
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
      x[i] = inicioX + offX[i]
      z[i] = inicioZ + offZ[i]
      grupoDe[i] = grupos.length
      g.miembros.push(i)
    }
    g.tx = g.cx = inicioX
    g.tz = g.cz = inicioZ
    grupos.push(g)
  }

  function hayCorredores() {
    for (let i = 0; i < n; i++) if (corre[i]) return true
    return false
  }

  /** While someone is running, the news next to the marker is off limits for the groups */
  function cercaDelMarcador(p) {
    const alcance = p.radio + EVITAR_MARCADOR
    return (p.x - guiaX) ** 2 + (p.z - guiaZ) ** 2 < alcance * alcance
  }

  /**
   * Next news for a group: nearby and relevant ones are more likely, and it doesn't
   * go back to the one it just left nor go near the marker while people run to it.
   * The destination is a point inside the circle, not the center, so several groups
   * can share a news.
   */
  function elegirNoticia(g) {
    let total = 0
    const evitar = hayCorredores()
    const pesos = puntos.map((p, k) => {
      if (!p.visible || k === g.objetivo || (k === g.anterior && puntos.length > 2)) return 0
      if (evitar && cercaDelMarcador(p)) return 0
      const d = Math.hypot(p.x - g.cx, p.z - g.cz)
      const w = p.peso / (1 + d / 8)
      total += w
      return w
    })

    // Nowhere to go: wait where it is and look again in a moment
    if (total === 0) {
      g.anterior = g.objetivo
      g.objetivo = -1
      g.tx = g.cx
      g.tz = g.cz
      g.parado = true
      g.timer = 2
      for (const i of g.miembros) objetivo[i] = -1
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

    const p = puntos[elegido]
    const angulo = random() * Math.PI * 2
    const radio = p.radio * 0.55 * Math.sqrt(random())
    g.anterior = g.objetivo
    g.objetivo = elegido
    g.tx = p.x + Math.cos(angulo) * radio
    g.tz = p.z + Math.sin(angulo) * radio
    g.parado = false
    g.timer = Infinity // set when it arrives
    for (const i of g.miembros) objetivo[i] = elegido
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

  /** News whose circle contains (px, pz), or -1 */
  function noticiaEn(px, pz) {
    for (let k = 0; k < puntos.length; k++) {
      const p = puntos[k]
      if (!p.visible) continue
      const ex = p.x - px
      const ez = p.z - pz
      if (ex * ex + ez * ez < p.radio * p.radio) return k
    }
    return -1
  }

  /**
   * Each group's centroid and average velocity (cohesion, alignment) counting only
   * the members that aren't running to the marker; arrivals and departures.
   */
  function actualizarGrupos(dt) {
    for (const g of grupos) {
      let cx = 0
      let cz = 0
      let gvx = 0
      let gvz = 0
      let m = 0
      for (const i of g.miembros) {
        if (corre[i]) continue
        cx += x[i]
        cz += z[i]
        gvx += vx[i]
        gvz += vz[i]
        m++
      }
      g.presentes = m
      if (m) {
        g.cx = cx / m
        g.cz = cz / m
        g.vx = gvx / m
        g.vz = gvz / m
      }

      if (m && !g.parado && g.objetivo >= 0) {
        const dx = g.tx - g.cx
        const dz = g.tz - g.cz
        if (dx * dx + dz * dz < 1) {
          g.parado = true
          g.timer = 8 + random() * 14 // how long it stays at the news
        }
      }
      g.timer -= dt
      if (g.timer <= 0) elegirNoticia(g)
    }
  }

  /** Returns the people that just reached their news (for the speech bubbles) */
  function paso(dt) {
    const llegadas = []
    if (dt <= 0) return llegadas
    reconstruirHash()
    actualizarGrupos(dt)
    reloj += dt

    const suavizado = Math.min(1, dt * 4)
    const suavizadoPrisa = Math.min(1, dt * 7) // runners turn on a dime

    // Runners this step (few: a plain list is cheaper than the hash for a bigger radius)
    const corredores = []
    for (let i = 0; i < n; i++) {
      if (corre[i] && reloj > correHasta[i]) corre[i] = 0
      if (corre[i]) corredores.push(i)
    }
    // The news under the marker went away (expired or filtered): the runners calm down
    if (noticiaGrito >= 0 && !puntos[noticiaGrito]?.visible) noticiaGrito = -1

    for (let i = 0; i < n; i++) {
      const sigue = corre[i] === 1
      const g = grupos[grupoDe[i]]

      // Seek with arrival: its spot around the marker (runners) or in its group's destination
      let tx = sigue ? guiaX + offRX[i] : g.tx + offX[i]
      let tz = sigue ? guiaZ + offRZ[i] : g.tz + offZ[i]
      if (sigue) {
        // Their spot keeps moving: they weave on the way and fidget once there
        const fr = ruidoF[i] * reloj + ruidoP[i]
        tx += Math.sin(fr) * ZIGZAG
        tz += Math.cos(fr * 1.3) * ZIGZAG
      }
      const dx = tx - x[i]
      const dz = tz - z[i]
      const d = Math.sqrt(dx * dx + dz * dz)
      const vMax = VEL_MAX * (sigue ? PRISA : g.velocidad)
      let deseadaX = 0
      let deseadaZ = 0
      if (d > 0.08) {
        const v = vMax * Math.min(1, d / 1.4)
        deseadaX = (dx / d) * v
        deseadaZ = (dz / d) * v
      }

      // Flocking inside the group while walking: stay together and keep the same pace
      if (!sigue && !g.parado && g.presentes > 1) {
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
        const fila = cz + oz
        if (fila < 0 || fila >= columnas) continue
        for (let ox = -1; ox <= 1; ox++) {
          const col = cx + ox
          if (col < 0 || col >= columnas) continue
          for (let j = cabeza[fila * columnas + col]; j !== -1; j = siguiente[j]) {
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

      // Everyone else: pushed away from the runners and from the marker
      if (!sigue && corredores.length) {
        for (const j of corredores) {
          const sx = x[i] - x[j]
          const sz = z[i] - z[j]
          const s2 = sx * sx + sz * sz
          if (s2 > RADIO_REPULSION * RADIO_REPULSION || s2 < 1e-6) continue
          const s = Math.sqrt(s2)
          const fuerza = (1 - s / RADIO_REPULSION) * FUERZA_REPULSION
          empujeX += (sx / s) * fuerza
          empujeZ += (sz / s) * fuerza
        }
        const mx = x[i] - guiaX
        const mz = z[i] - guiaZ
        const m2 = mx * mx + mz * mz
        if (m2 < RADIO_MARCADOR * RADIO_MARCADOR && m2 > 1e-6) {
          const m = Math.sqrt(m2)
          const fuerza = (1 - m / RADIO_MARCADOR) * FUERZA_MARCADOR
          empujeX += (mx / m) * fuerza
          empujeZ += (mz / m) * fuerza
        }
      }

      // Runners get random kicks: they elbow their way there
      if (sigue && d > 1.5) {
        deseadaX += (random() - 0.5) * EMPUJONES
        deseadaZ += (random() - 0.5) * EMPUJONES
      }

      const k0 = sigue ? suavizadoPrisa : suavizado
      vx[i] += (deseadaX + empujeX - vx[i]) * k0
      vz[i] += (deseadaZ + empujeZ - vz[i]) * k0
      x[i] = Math.max(-lim, Math.min(lim, x[i] + vx[i] * dt))
      z[i] = Math.max(-lim, Math.min(lim, z[i] + vz[i] * dt))

      const vel = Math.sqrt(vx[i] * vx[i] + vz[i] * vz[i])
      rapidez[i] = vel
      fase[i] += vel * dt * 8

      // Face where it walks; once still, face the marker (runners) or its news
      const p = objetivo[i] >= 0 ? puntos[objetivo[i]] : null
      let yawDeseado = null
      if (vel > 0.2) yawDeseado = Math.atan2(vx[i], vz[i])
      else if (sigue) yawDeseado = Math.atan2(guiaX - x[i], guiaZ - z[i])
      else if (p) yawDeseado = Math.atan2(p.x - x[i], p.z - z[i])
      if (yawDeseado !== null) {
        let delta = yawDeseado - yaw[i]
        delta = Math.atan2(Math.sin(delta), Math.cos(delta))
        yaw[i] += delta * Math.min(1, dt * 6)
      }

      // Arrival at its spot by the marker: reported once (a few say something)
      if (sigue && !llegoAlGrito[i] && d < 1.6) {
        llegoAlGrito[i] = 1
        llegadas.push(i)
      }

      // Emotion (runners of a shout on a news only): drawn when it hears the shout and
      // faded in while it runs; faded out once it stops running or the news goes away
      const k = noticiaGrito
      const siente = sigue && k >= 0 && puntos[k].visible
      if (siente && emocionDe[i] === k && emocion[i] >= 0) {
        mezcla[i] = Math.min(1, mezcla[i] + dt / FUNDIDO)
      } else if (siente && emocion[i] < 0) {
        emocion[i] = CLAVES_EMOCION.indexOf(sortearEmocion(puntos[k].noticia, random, { sinNeutral: true }))
        emocionDe[i] = k
      } else {
        mezcla[i] = Math.max(0, mezcla[i] - dt / FUNDIDO)
        if (mezcla[i] === 0) {
          emocion[i] = -1
          emocionDe[i] = -1
        }
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

    /** Hidden news: its groups leave for another one right away */
    actualizarVisibilidad() {
      for (const g of grupos) {
        if (g.objetivo >= 0 && !puntos[g.objetivo]?.visible) elegirNoticia(g)
      }
    },

    paso,

    /**
     * A shout from (px, pz) heard by exactly `cantidad` people. The previous runners
     * go back to their groups; the rest are drawn without replacement with a weight
     * that drops with distance, so mostly the nearby ones run but sometimes someone
     * from far away does too. Returns who heard it, closest first.
     */
    gritar(px, pz, cantidad) {
      guiaX = Math.max(-lim, Math.min(lim, px))
      guiaZ = Math.max(-lim, Math.min(lim, pz))
      noticiaGrito = noticiaEn(guiaX, guiaZ)

      const candidatos = []
      for (let i = 0; i < n; i++) {
        if (corre[i]) {
          corre[i] = 0
          continue
        }
        const d = Math.hypot(x[i] - guiaX, z[i] - guiaZ)
        // Weighted draw (Efraimidis–Spirakis): the `cantidad` largest keys win.
        // In log form, log(u) / w, so tiny weights far away don't underflow to 0.
        const peso = Math.exp(-d / ALCANCE_GRITO)
        candidatos.push({ i, d, llave: Math.log(random()) / peso })
      }
      candidatos.sort((a, b) => b.llave - a.llave)
      const oyen = candidatos.slice(0, cantidad).sort((a, b) => a.d - b.d)

      // Loose sunflower around the marker, the first to hear it closest to the center
      oyen.forEach(({ i }, rango) => {
        const r = 0.62 * Math.sqrt(rango + 0.5)
        const a = rango * 2.39996
        offRX[i] = Math.cos(a) * r
        offRZ[i] = Math.sin(a) * r
        corre[i] = 1
        correHasta[i] = reloj + TIEMPO_CORRIENDO
        llegoAlGrito[i] = 0
        // Feels it right away: the color starts changing while it runs
        if (noticiaGrito >= 0) {
          emocion[i] = CLAVES_EMOCION.indexOf(sortearEmocion(puntos[noticiaGrito].noticia, random, { sinNeutral: true }))
          emocionDe[i] = noticiaGrito
        }
      })

      // Groups heading to a news next to the marker go somewhere else
      for (const g of grupos) {
        if (g.objetivo >= 0 && cercaDelMarcador(puntos[g.objetivo])) elegirNoticia(g)
      }
      return oyen.map((c) => c.i)
    },

    get guia() {
      return { x: guiaX, z: guiaZ }
    },

    /** Slot of the news under the marker while people run to it, or -1 */
    get noticiaGrito() {
      return hayCorredores() ? noticiaGrito : -1
    },

    /** Where the runners are now (their centroid), or null if nobody is running */
    centroCorredores() {
      let cx = 0
      let cz = 0
      let m = 0
      for (let i = 0; i < n; i++) {
        if (!corre[i]) continue
        cx += x[i]
        cz += z[i]
        m++
      }
      return m ? { x: cx / m, z: cz / m } : null
    },

    /** Runs the simulation without drawing (reduced motion: finished frame) */
    asentar(segundos = 40, dt = 1 / 20) {
      for (let s = 0; s < segundos / dt; s++) paso(dt)
      for (let i = 0; i < n; i++) {
        vx[i] = 0
        vz[i] = 0
        rapidez[i] = 0
        if (emocion[i] >= 0) mezcla[i] = 1
      }
    },

    /** Emotion key of a person, or null */
    claveEmocion(i) {
      return emocion[i] >= 0 ? CLAVES_EMOCION[emocion[i]] : null
    },
  }
}
