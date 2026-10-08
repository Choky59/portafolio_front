import { CLAVES_EMOCION } from './emociones.js'
import { GRAFITO, texturaSombra } from './lapiz.js'

/**
 * Draws the crowd of a simulation (simulacion.js) with InstancedMesh:
 * one draw call per body part no matter how many people there are.
 *
 * Pencil-drawing look: white figures with a soft toon shade, black outline
 * ("inverted hull": the same geometry slightly bigger, back faces only, in black),
 * hair on some heads and a hatched contact shadow. Only the emotion adds color.
 */
const CONTORNO = 0.04

// Proportions of a ~1.1 unit tall person (scaled per person)
const CADERA_Y = 0.36
const CUERPO_Y = 0.62
const CABEZA_Y = 1.02
const SEPARACION_PIERNAS = 0.09

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

  function poner(malla, i, px, py, pz, rotY, rotX, s) {
    dummy.position.set(px, py, pz)
    dummy.rotation.set(rotX, rotY, 0)
    dummy.scale.setScalar(s)
    dummy.updateMatrix()
    malla.setMatrixAt(i, dummy.matrix)
  }

  /** Copies the simulation state into the instances (call once per frame) */
  function actualizar() {
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

      const cadera = CADERA_Y * s + rebote * 0.5
      const sep = SEPARACION_PIERNAS * s
      poner(piernaIzq, i, x - ladoX * sep, cadera, z - ladoZ * sep, yaw, balanceo, s)
      poner(piernaDer, i, x + ladoX * sep, cadera, z + ladoZ * sep, yaw, -balanceo, s)
      poner(cuerpo, i, x, CUERPO_Y * s + rebote, z, yaw, 0.12 * caminar, s)

      const cabezaX = x + adelanteX * 0.04 * caminar
      const cabezaZ = z + adelanteZ * 0.04 * caminar
      poner(cabeza, i, cabezaX, CABEZA_Y * s + rebote, cabezaZ, yaw, 0, s)
      poner(pelo, i, cabezaX, CABEZA_Y * s + rebote, cabezaZ, yaw, 0, sim.pelo[i] ? s : 0)

      // Hatched contact shadow, stretched away from the light (down-right)
      dummy.position.set(x + 0.28, 0.012, z + 0.16)
      dummy.rotation.set(0, -0.5, 0)
      dummy.scale.set(1.15 * s, 1, 0.6 * s)
      dummy.updateMatrix()
      sombras.setMatrixAt(i, dummy.matrix)

      const e = sim.emocion[i]
      if (e >= 0) color.copy(neutral).lerp(coloresEmocion[e], sim.mezcla[i])
      else color.copy(neutral)
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
    sombras.instanceMatrix.needsUpdate = true
  }

  return { grupo, actualizar, alturaCabeza: CABEZA_Y }
}
