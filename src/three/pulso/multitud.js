import { CLAVES_EMOCION } from './emociones.js'
import { ANIMACIONES, PARPADEO } from './animaciones.js'
import { GRAFITO, texturaSombra } from './lapiz.js'
import { rng } from '../piezas.js'

/**
 * Draws the crowd of a simulation (simulacion.js) with InstancedMesh:
 * one draw call per body part no matter how many people there are.
 *
 * Pencil-drawing look: white figures with a soft toon shade, black outline
 * ("inverted hull": the same geometry slightly bigger, back faces only, in black),
 * hair on some heads, two dot eyes and a hatched contact shadow. Only the emotion
 * adds color.
 *
 * Each emotion moves its own way while the person stands at its news (see
 * animaciones.js): the anger shake, the joy hops, the fearful tremble... Everyone
 * has its own phase and rhythm, so nobody is in sync. The head position of every
 * person is kept (cabezaX/Y/Z, plus where it faces) for the particles.
 */
const CONTORNO = 0.04

// Proportions of a ~1.1 unit tall person (scaled per person)
const CADERA_Y = 0.36
const CUERPO_Y = 0.62
const CABEZA_Y = 1.02
const SEPARACION_PIERNAS = 0.09
// Eyes on the face, in head space (the head is a 0.19 sphere facing +z)
const OJO_X = 0.068
const OJO_Y = 0.03
const OJO_Z = 0.172

/** 3-step gradient for MeshToonMaterial: light flat bands, like shading with a pencil */
function gradienteToon(THREE) {
  const datos = new Uint8Array([205, 235, 255])
  const textura = new THREE.DataTexture(datos, datos.length, 1, THREE.RedFormat)
  textura.minFilter = THREE.NearestFilter
  textura.magFilter = THREE.NearestFilter
  textura.generateMipmaps = false
  textura.needsUpdate = true
  return textura
}

/** Body settings per emotion index (CLAVES_EMOCION order); people with no emotion use neutral's */
const CUERPOS = CLAVES_EMOCION.map((c) => ANIMACIONES[c]?.cuerpo ?? {})
const CUERPO_NEUTRAL = ANIMACIONES.neutral?.cuerpo ?? {}

/** Period inside a [min, max] range (or a single number) for a person's 0–1 rhythm */
const periodo = (cada, ritmo) => (Array.isArray(cada) ? cada[0] + ritmo * (cada[1] - cada[0]) : cada)

export function crearMultitud(THREE, sim, paleta) {
  const n = sim.n
  const grupo = new THREE.Group()

  const toon = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradienteToon(THREE) })
  const negro = new THREE.MeshBasicMaterial({ color: GRAFITO, side: THREE.BackSide })
  const peloMat = new THREE.MeshBasicMaterial({ color: GRAFITO })

  // Geometries centered on their pivot, so the outline can be a uniform scale-up
  const piernaGeo = new THREE.CapsuleGeometry(0.075, 0.2, 2, 6)
  piernaGeo.translate(0, -(0.1 + 0.075), 0) // pivot at the hip
  const cuerpoGeo = new THREE.CapsuleGeometry(0.2, 0.26, 3, 10)
  const cabezaGeo = new THREE.SphereGeometry(0.19, 14, 10)
  const peloGeo = new THREE.SphereGeometry(0.2, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42)
  peloGeo.rotateX(-0.35) // hairline a bit toward the back
  const ojoGeo = new THREE.SphereGeometry(0.03, 8, 6)

  function contornoDe(geo, radio) {
    const k = (radio + CONTORNO) / radio
    return geo.clone().scale(k, k, k)
  }

  function parte(geo, radio, conColor = true) {
    const malla = new THREE.InstancedMesh(geo, conColor ? toon : peloMat, n)
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    malla.frustumCulled = false
    const contorno = new THREE.InstancedMesh(contornoDe(geo, radio), negro, n)
    contorno.instanceMatrix = malla.instanceMatrix // same matrices, uploaded once
    contorno.frustumCulled = false
    grupo.add(contorno, malla)
    return malla
  }

  const piernaIzq = parte(piernaGeo, 0.075)
  const piernaDer = parte(piernaGeo, 0.075)
  const cuerpo = parte(cuerpoGeo, 0.2)
  const cabeza = parte(cabezaGeo, 0.19)
  const pelo = new THREE.InstancedMesh(peloGeo, peloMat, n)
  pelo.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  pelo.frustumCulled = false
  grupo.add(pelo)
  const ojos = new THREE.InstancedMesh(ojoGeo, peloMat, n * 2)
  ojos.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  ojos.frustumCulled = false
  grupo.add(ojos)

  const sombras = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texturaSombra(THREE), transparent: true, depthWrite: false, opacity: 0.55 }),
    n
  )
  sombras.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  sombras.frustumCulled = false
  sombras.renderOrder = -1
  grupo.add(sombras)

  const coloresEmocion = CLAVES_EMOCION.map((c) => new THREE.Color(paleta[c]))
  const neutral = new THREE.Color(0xffffff)
  const color = new THREE.Color()
  const dummy = new THREE.Object3D()
  dummy.rotation.order = 'YXZ'
  const matrizCabeza = new THREE.Matrix4()
  const local = new THREE.Matrix4()
  const escalaOjo = new THREE.Matrix4()

  // Each person's own phase (0–2π) and rhythm (0–1), so nobody moves in sync
  const random = rng(sim.n * 13 + 5)
  const fase0 = Float32Array.from({ length: n }, () => random() * Math.PI * 2)
  const ritmo = Float32Array.from({ length: n }, () => random())
  const ritmoOjos = Float32Array.from({ length: n }, () => random())

  // Where each head is (and faces) after this frame's animation: read by the particles
  const cabezaX = new Float32Array(n)
  const cabezaY = new Float32Array(n)
  const cabezaZ = new Float32Array(n)
  const mira = new Float32Array(n) // yaw

  function poner(malla, i, px, py, pz, rotY, rotX, sx, sy) {
    dummy.position.set(px, py, pz)
    dummy.rotation.set(rotX, rotY, 0)
    dummy.scale.set(sx, sy, sx)
    dummy.updateMatrix()
    malla.setMatrixAt(i, dummy.matrix)
  }

  /** 0 → 1 → 0 bump at the start of every period (for beats, starts and hops) */
  function golpe(t, T, fase, ancho) {
    const u = (((t / T + fase / (Math.PI * 2)) % 1) + 1) % 1
    return u < ancho ? Math.sin((Math.PI * u) / ancho) : 0
  }

  /**
   * The emotion's pose for person i at time t, scaled by `a` (0 = none, 1 = full):
   * fills `pose` with offsets (lateral, up, forward), squash (sx, sy), head bow and
   * how much darker the color gets.
   */
  const pose = { lado: 0, arriba: 0, adelante: 0, sx: 1, sy: 1, cabeza: 0, oscuro: 0 }
  function calcularPose(c, i, t, a, reducido) {
    pose.lado = pose.arriba = pose.adelante = pose.cabeza = pose.oscuro = 0
    pose.sx = pose.sy = 1
    if (a <= 0) return
    // Reduced motion: only the still poses (a bowed head), nothing that moves
    if (reducido) {
      pose.cabeza = (c.cabizbajo ?? 0) * a
      return
    }
    const f = fase0[i]
    const r = ritmo[i]

    if (c.temblor) {
      const { amplitud, velocidad } = c.temblor
      pose.lado += (Math.sin(t * velocidad + f) * 0.7 + Math.sin(t * velocidad * 1.7 + f * 3) * 0.3) * amplitud * a
    }
    if (c.pulso) pose.oscuro = golpe(t, c.pulso.cada, f, 0.35) * c.pulso.color * a
    if (c.brinco) {
      const { altura, cada, aplastar } = c.brinco
      const T = periodo(cada, r)
      const u = (((t / T + f / (Math.PI * 2)) % 1) + 1) % 1
      const AIRE = 0.72
      if (u < AIRE) {
        const v = u / AIRE
        pose.arriba += Math.sin(Math.PI * v) * altura * a
        // Stretched while it rises and falls fast, round at the top
        const estirar = Math.abs(Math.cos(Math.PI * v)) * aplastar * 0.45 * a
        pose.sy *= 1 + estirar
        pose.sx *= 1 - estirar * 0.5
      } else {
        // On the ground: squashed on landing and before the next jump
        const aplasta = Math.sin((Math.PI * (u - AIRE)) / (1 - AIRE)) * aplastar * a
        pose.sy *= 1 - aplasta
        pose.sx *= 1 + aplasta * 0.6
      }
    }
    if (c.susto) {
      const k = golpe(t, periodo(c.susto.cada, r), f, 0.12)
      pose.arriba += k * c.susto.salto * a
      pose.adelante -= k * (c.susto.atras ?? 0) * a
    }
    if (c.cabizbajo) {
      pose.cabeza = c.cabizbajo * a
      pose.arriba -= 0.03 * a
    }
    if (c.respiracion) {
      const { cada, cuanto } = c.respiracion
      pose.sy *= 1 + Math.sin((t / cada) * Math.PI * 2 + f) * cuanto * a
    }
  }

  /** Copies the simulation state into the instances (call once per frame) */
  function actualizar(t = 0, reducido = false) {
    for (let i = 0; i < n; i++) {
      const x = sim.x[i]
      const z = sim.z[i]
      const s = sim.escala[i]
      const yaw = sim.yaw[i]
      const caminar = Math.min(1, sim.rapidez[i] / 1.2)
      const rebote = Math.abs(Math.sin(sim.fase[i])) * 0.05 * caminar
      const balanceo = Math.sin(sim.fase[i]) * 0.65 * caminar
      const adelanteX = Math.sin(yaw)
      const adelanteZ = Math.cos(yaw)
      // local +X (the person's right) in world space
      const ladoX = Math.cos(yaw)
      const ladoZ = -Math.sin(yaw)

      // The emotion's animation, only while standing (it fades in with the color)
      const e = sim.emocion[i]
      const quieto = 1 - caminar
      const a = (e >= 0 ? sim.mezcla[i] : 1) * quieto
      calcularPose(e >= 0 ? CUERPOS[e] : CUERPO_NEUTRAL, i, t, a, reducido)
      const px = x + ladoX * pose.lado + adelanteX * pose.adelante
      const pz = z + ladoZ * pose.lado + adelanteZ * pose.adelante
      const base = pose.arriba
      const sx = s * pose.sx
      const sy = s * pose.sy

      const cadera = CADERA_Y * sy + rebote * 0.5 + base
      const sep = SEPARACION_PIERNAS * sx
      poner(piernaIzq, i, px - ladoX * sep, cadera, pz - ladoZ * sep, yaw, balanceo, sx, sy)
      poner(piernaDer, i, px + ladoX * sep, cadera, pz + ladoZ * sep, yaw, -balanceo, sx, sy)
      poner(cuerpo, i, px, CUERPO_Y * sy + rebote + base, pz, yaw, 0.12 * caminar, sx, sy)

      const hx = px + adelanteX * (0.04 * caminar + pose.cabeza * 0.08)
      const hz = pz + adelanteZ * (0.04 * caminar + pose.cabeza * 0.08)
      const hy = CABEZA_Y * sy + rebote + base
      poner(cabeza, i, hx, hy, hz, yaw, pose.cabeza, s, s)
      matrizCabeza.copy(dummy.matrix)
      poner(pelo, i, hx, hy, hz, yaw, pose.cabeza, sim.pelo[i] ? s : 0, sim.pelo[i] ? s : 0)
      cabezaX[i] = hx
      cabezaY[i] = hy
      cabezaZ[i] = hz
      mira[i] = yaw

      // Eyes: two dots on the face, following the head; a blink now and then
      const T = periodo(PARPADEO.cada, ritmoOjos[i])
      const parpado = !reducido && ((t + fase0[i]) % T) < PARPADEO.dura ? 0.12 : 1
      escalaOjo.makeScale(1, parpado, 1)
      for (const lado of [-1, 1]) {
        local.makeTranslation(OJO_X * lado, OJO_Y, OJO_Z).multiply(escalaOjo)
        dummy.matrix.multiplyMatrices(matrizCabeza, local)
        ojos.setMatrixAt(i * 2 + (lado > 0 ? 1 : 0), dummy.matrix)
      }

      // Hatched contact shadow, stretched away from the light (down-right); smaller in the air
      const enAire = 1 - Math.min(0.4, base)
      dummy.position.set(px + 0.28, 0.012, pz + 0.16)
      dummy.rotation.set(0, -0.5, 0)
      dummy.scale.set(1.15 * s * enAire, 1, 0.6 * s * enAire)
      dummy.updateMatrix()
      sombras.setMatrixAt(i, dummy.matrix)

      if (e >= 0) {
        color.copy(neutral).lerp(coloresEmocion[e], sim.mezcla[i])
        if (pose.oscuro) color.multiplyScalar(1 - pose.oscuro)
      } else color.copy(neutral)
      cuerpo.setColorAt(i, color)
      cabeza.setColorAt(i, color)
      piernaIzq.setColorAt(i, color)
      piernaDer.setColorAt(i, color)
    }

    for (const malla of [piernaIzq, piernaDer, cuerpo, cabeza]) {
      malla.instanceMatrix.needsUpdate = true
      malla.instanceColor.needsUpdate = true
    }
    pelo.instanceMatrix.needsUpdate = true
    ojos.instanceMatrix.needsUpdate = true
    sombras.instanceMatrix.needsUpdate = true
  }

  return {
    grupo,
    actualizar,
    alturaCabeza: CABEZA_Y,
    cabezaX, cabezaY, cabezaZ, mira,
    /** Per-person phase (0–2π), for things that should differ from person to person */
    fase0,
  }
}
