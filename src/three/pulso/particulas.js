import { CLAVES_EMOCION } from './emociones.js'
import { ANIMACIONES, AUMENTO_CADA, AUMENTO_MAX, LIMITES } from './animaciones.js'
import { TIPOS_PARTICULA, texturaParticula } from './lapiz.js'
import { rng } from '../piezas.js'

/**
 * What the emotions give off: anger veins, confetti, tears, sweat... (the list and
 * how often each one comes are in animaciones.js).
 *
 * One InstancedMesh per kind of particle with a fixed pool (LIMITES.porTipo): no
 * objects are created per frame, and when a pool is full new ones are just skipped.
 * They're flat drawings facing the camera, with their own opacity per instance.
 * They live in the 3D scene, so the speech bubbles (HTML on top) always stay above.
 *
 * Who gives off what: people whose emotion color is (almost) full and who are
 * standing at their news. Each person has a timer per particle of its emotion;
 * confetti (porGrupo) has one per news and falls over its circle.
 */

/** Size (world units) and motion of each kind */
const TIPOS = {
  // Attached to the head, beating
  vena: { tamano: 0.42, pegado: true, offset: [0.2, 0.32], movimiento: 'late' },
  // Float up from the head, wavy, and fade
  vapor: { tamano: 0.42, offset: [0, 0.35], movimiento: 'sube', crece: 0.8 },
  destello: { tamano: 0.34, offset: [0, 0.35], movimiento: 'sube' },
  nota: { tamano: 0.34, offset: [0, 0.35], movimiento: 'sube' },
  // Pops over the head with an overshoot
  exclamacion: { tamano: 0.5, pegado: true, offset: [0.05, 0.45], movimiento: 'salta' },
  interrogacion: { tamano: 0.5, pegado: true, offset: [0.05, 0.45], movimiento: 'salta' },
  // Beside the head, slides down
  sudor: { tamano: 0.2, pegado: true, offset: [0.24, 0.08], movimiento: 'resbala' },
  // From an eye, falls to the ground
  lagrima: { tamano: 0.16, ojo: true, movimiento: 'cae' },
  // Over the head, bobbing
  nube: { tamano: 0.75, pegado: true, offset: [0, 0.75], movimiento: 'flota' },
  // From above the news, fluttering down
  confeti: { tamano: 0.17, movimiento: 'revolotea' },
}

const COLORES_CONFETI = ['alegria', 'sorpresa', 'tristeza', 'miedo', 'enojo']
const EMITE_DESDE = 0.8 // color mix needed to give off particles

export function crearParticulas(THREE, sim, multitud, paleta) {
  const grupo = new THREE.Group()
  const random = rng(77)
  const azar = (cada) => (Array.isArray(cada) ? cada[0] + random() * (cada[1] - cada[0]) : cada)
  const coloresConfeti = COLORES_CONFETI.map((c) => new THREE.Color(paleta[c]))

  /* ---------- pools ---------- */

  const plano = new THREE.PlaneGeometry(1, 1)
  const pools = {}
  for (const tipo of TIPOS_PARTICULA) {
    const max = LIMITES.porTipo
    const geo = plano.clone()
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1)
    alpha.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aAlpha', alpha)
    const material = new THREE.MeshBasicMaterial({
      map: texturaParticula(THREE, tipo),
      transparent: true,
      depthWrite: false,
    })
    // Per-instance opacity: a vertex attribute multiplied into the final alpha
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vAlpha;')
    }
    const malla = new THREE.InstancedMesh(geo, material, max)
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    malla.frustumCulled = false
    malla.renderOrder = 2
    if (tipo === 'confeti') malla.setColorAt(0, coloresConfeti[0]) // creates instanceColor
    grupo.add(malla)

    pools[tipo] = {
      malla,
      alpha,
      vivas: Array.from({ length: max }, () => ({
        activa: false, vida: 0, dura: 1, persona: -1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, giro: 0, vgiro: 0, semilla: 0,
      })),
    }
  }

  function libreDe(tipo) {
    return pools[tipo].vivas.find((p) => !p.activa) ?? null
  }

  /* ---------- spawning ---------- */

  // For each emotion, its per-person particle entries (porGrupo ones apart)
  const entradas = CLAVES_EMOCION.map((c) => (ANIMACIONES[c]?.particulas ?? []).filter((p) => !p.porGrupo))
  const entradasGrupo = CLAVES_EMOCION.map((c) => (ANIMACIONES[c]?.particulas ?? []).filter((p) => p.porGrupo))
  const maxEntradas = Math.max(1, ...entradas.map((l) => l.length))
  // timers[j][i]: seconds until person i gives off its emotion's j-th particle
  const timers = Array.from({ length: maxEntradas }, () => new Float32Array(sim.n).fill(-1))
  const emocionTimer = new Int8Array(sim.n).fill(-1)
  const timersGrupo = new Map() // `${slot}|${emotion}|${j}` -> seconds

  /** Each person's 0–1 draw, for `soloAlgunos` (always the same person) */
  const sorteo = Float32Array.from({ length: sim.n }, (_, i) => (Math.sin(multitud.fase0[i] * 97.13) + 1) / 2)

  function nacer(tipo, i, x, y, z) {
    const p = libreDe(tipo)
    if (!p) return
    const conf = TIPOS[tipo]
    p.activa = true
    p.vida = 0
    p.persona = i
    p.x = x
    p.y = y
    p.z = z
    p.vx = (random() - 0.5) * 0.3
    p.vy = 0
    p.vz = (random() - 0.5) * 0.3
    p.giro = conf.movimiento === 'revolotea' ? random() * Math.PI * 2 : (random() - 0.5) * 0.3
    p.vgiro = conf.movimiento === 'revolotea' ? (random() - 0.5) * 8 : 0
    p.semilla = random() * Math.PI * 2
    return p
  }

  /** A particle from person i's head (or eye) */
  function desdePersona(tipo, i, dura) {
    const conf = TIPOS[tipo]
    let x = multitud.cabezaX[i]
    let y = multitud.cabezaY[i]
    let z = multitud.cabezaZ[i]
    if (conf.ojo) {
      // One of the eyes, on the face
      const lado = random() < 0.5 ? -1 : 1
      const yaw = multitud.mira[i]
      x += Math.sin(yaw) * 0.17 + Math.cos(yaw) * 0.07 * lado
      z += Math.cos(yaw) * 0.17 - Math.sin(yaw) * 0.07 * lado
    }
    const p = nacer(tipo, i, x, y, z)
    if (p) p.dura = dura
  }

  function emitir(dt, puntos) {
    // Per person
    for (let i = 0; i < sim.n; i++) {
      const e = sim.emocion[i]
      const lista = e >= 0 ? entradas[e] : null
      const listo = lista?.length && sim.mezcla[i] >= EMITE_DESDE && sim.rapidez[i] < 0.3
      if (!listo) {
        emocionTimer[i] = -1
        continue
      }
      // A new emotion: first particles at random moments, not all at once on arrival
      if (emocionTimer[i] !== e) {
        emocionTimer[i] = e
        lista.forEach((entrada, j) => (timers[j][i] = random() * azar(entrada.cada)))
      }
      lista.forEach((entrada, j) => {
        if (entrada.soloAlgunos !== undefined && sorteo[i] > entrada.soloAlgunos) return
        timers[j][i] -= dt
        if (timers[j][i] > 0) return
        timers[j][i] = azar(entrada.cada)
        const tipo = Array.isArray(entrada.tipo) ? entrada.tipo[Math.floor(random() * entrada.tipo.length)] : entrada.tipo
        desdePersona(tipo, i, entrada.dura ?? 1.5)
      })
    }

    // Per news (confetti): when it has people with that emotion
    const hay = new Map()
    for (let i = 0; i < sim.n; i++) {
      const e = sim.emocion[i]
      const k = sim.objetivo[i]
      if (e < 0 || k < 0 || !entradasGrupo[e].length || sim.mezcla[i] < EMITE_DESDE) continue
      hay.set(`${k}|${e}`, true)
    }
    for (const clave of hay.keys()) {
      const [k, e] = clave.split('|').map(Number)
      const p = puntos[k]
      if (!p?.visible) continue
      entradasGrupo[e].forEach((entrada, j) => {
        const id = `${clave}|${j}`
        const restante = (timersGrupo.get(id) ?? random() * azar(entrada.cada)) - dt
        if (restante > 0) return timersGrupo.set(id, restante)
        timersGrupo.set(id, azar(entrada.cada))
        for (let c = 0; c < (entrada.cuantas ?? 8); c++) {
          const a = random() * Math.PI * 2
          const r = Math.sqrt(random()) * p.radio * 0.8
          const q = nacer(entrada.tipo, -1, p.x + Math.cos(a) * r, 2.6 + random() * 1.2, p.z + Math.sin(a) * r)
          if (!q) break
          q.dura = 3
          q.color = coloresConfeti[Math.floor(random() * coloresConfeti.length)]
        }
      })
    }
    // Forget the timers of news that are gone
    for (const id of timersGrupo.keys()) if (!hay.has(id.split('|').slice(0, 2).join('|'))) timersGrupo.delete(id)
  }

  /* ---------- motion ---------- */

  const dummy = new THREE.Object3D()
  const giroZ = new THREE.Quaternion()
  const eje = new THREE.Vector3(0, 0, 1)
  const derecha = new THREE.Vector3()

  // Reused for every particle, so moving them allocates nothing
  const resultado = { alpha: 0, escala: 1, ox: 0, oy: 0 }
  function salida(alpha, escala, ox, oy) {
    resultado.alpha = alpha
    resultado.escala = escala
    resultado.ox = ox
    resultado.oy = oy
    return resultado
  }

  /** Moves a live particle; returns its opacity, size multiplier and screen offset (shared object) */
  function mover(tipo, p, dt) {
    const conf = TIPOS[tipo]
    p.vida += dt
    const u = p.vida / p.dura
    const i = p.persona
    let alpha = Math.min(1, u * 6) * Math.min(1, (1 - u) * 4) // quick fade in, fade out at the end
    let escala = 1

    // Attached ones follow the person's head
    if (conf.pegado && i >= 0) {
      p.x = multitud.cabezaX[i]
      p.y = multitud.cabezaY[i]
      p.z = multitud.cabezaZ[i]
    }
    const [ox, oy] = conf.offset ?? [0, 0]

    switch (conf.movimiento) {
      case 'late':
        escala = 1 + 0.3 * Math.max(0, Math.sin(p.vida * 9)) // 1 → 1.3 → 1
        return salida(alpha, escala, ox, oy)
      case 'salta':
        escala = u < 0.2 ? 0.4 + (u / 0.2) * 0.9 : 1.3 - Math.min(0.3, (u - 0.2) * 1.5)
        return salida(alpha, escala, ox, oy + Math.max(0, Math.sin(u * Math.PI * 3)) * 0.06)
      case 'sube':
        p.y += dt * 0.55
        p.x += Math.sin(p.vida * 3 + p.semilla) * dt * 0.25
        escala = 1 + (conf.crece ?? 0.2) * u
        return salida(alpha, escala, ox, oy)
      case 'resbala':
        return salida(alpha, escala, ox, oy - u * 0.28)
      case 'flota':
        return salida(alpha, escala, ox, oy + Math.sin(p.vida * 2 + p.semilla) * 0.04)
      case 'cae':
        p.vy -= 3.2 * dt
        p.y = Math.max(0.03, p.y + p.vy * dt)
        if (p.y <= 0.03) alpha *= 0.4 // splash: fades on the ground
        return salida(alpha, escala, ox, oy)
      case 'revolotea':
        p.y = Math.max(0.02, p.y - dt * 0.9)
        p.x += Math.sin(p.vida * 4 + p.semilla) * dt * 0.6
        p.z += Math.cos(p.vida * 3 + p.semilla) * dt * 0.4
        p.giro += p.vgiro * dt
        if (p.y <= 0.02) p.vida = Math.max(p.vida, p.dura - 0.4) // landed: fade out
        return salida(alpha, escala, ox, oy)
      default:
        return salida(alpha, escala, ox, oy)
    }
  }

  /** One frame: new particles and the motion of the live ones. `puntos` are the news slots */
  function actualizar(dt, camera, puntos) {
    if (dt > 0) emitir(dt, puntos)

    // Bigger when the camera is far, so they read at the default zoom
    const aumento = Math.min(AUMENTO_MAX, Math.max(1, camera.position.length() / AUMENTO_CADA))
    derecha.set(1, 0, 0).applyQuaternion(camera.quaternion)
    for (const [tipo, pool] of Object.entries(pools)) {
      const { malla, alpha, vivas } = pool
      const conf = TIPOS[tipo]
      vivas.forEach((p, k) => {
        if (p.activa && p.vida >= p.dura) p.activa = false
        if (!p.activa) {
          alpha.setX(k, 0)
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          malla.setMatrixAt(k, dummy.matrix)
          return
        }
        const m = mover(tipo, p, dt)
        const tam = conf.tamano * m.escala * aumento
        // Offsets are in screen space: right and up as the camera sees it
        dummy.position.set(p.x, p.y, p.z)
        dummy.position.addScaledVector(derecha, m.ox * aumento)
        dummy.position.y += m.oy * aumento
        dummy.quaternion.copy(camera.quaternion).multiply(giroZ.setFromAxisAngle(eje, p.giro))
        dummy.scale.set(tam, tam, tam)
        dummy.updateMatrix()
        malla.setMatrixAt(k, dummy.matrix)
        alpha.setX(k, m.alpha)
        if (p.color) malla.setColorAt(k, p.color)
      })
      malla.instanceMatrix.needsUpdate = true
      alpha.needsUpdate = true
      if (malla.instanceColor) malla.instanceColor.needsUpdate = true
    }
  }

  /** Live particles per kind (to check nothing leaks) */
  function vivas() {
    return Object.fromEntries(Object.entries(pools).map(([t, p]) => [t, p.vivas.filter((q) => q.activa).length]))
  }

  return { grupo, actualizar, vivas }
}
