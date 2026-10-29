import * as THREE from 'three'
import { COLORES } from '../render/colores.js'
import { toon } from './materiales.js'

/**
 * Things that only exist on screen: tire marks on the ground and puffs of dust and smoke.
 * They never affect the game, so each client makes its own from the cars' state.
 * Both are instanced meshes used as ring buffers: one draw call each.
 */
const MAX_MARCAS = 2000
const MAX_PUFFS = 240
const ANCHO_MARCA = 0.32

export function crearEfectos3D(escena) {
  const matriz = new THREE.Matrix4()
  const posicion = new THREE.Vector3()
  const giro = new THREE.Quaternion()
  const escala = new THREE.Vector3()
  const arriba = new THREE.Vector3(0, 1, 0)
  const cero = new THREE.Matrix4().makeScale(0, 0, 0)

  // Tire marks: flat quads lying just above the floor
  const marcas = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: COLORES.tinta,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    MAX_MARCAS,
  )
  marcas.frustumCulled = false
  for (let i = 0; i < MAX_MARCAS; i++) marcas.setMatrixAt(i, cero)
  let cabezaMarcas = 0

  // Puffs: faceted balls that grow and then shrink away
  const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), toon('#ffffff'), MAX_PUFFS)
  puffs.frustumCulled = false
  puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const vivos = []
  let cabezaPuffs = 0
  for (let i = 0; i < MAX_PUFFS; i++) {
    puffs.setMatrixAt(i, cero)
    puffs.setColorAt(i, new THREE.Color(COLORES.humo))
  }

  escena.add(marcas, puffs)

  /** Last rear wheel positions per car, or null when it isn't leaving marks */
  const ruedas = new Map()
  const color = new THREE.Color()

  function agregarMarca(x1, z1, x2, z2) {
    const largo = Math.hypot(x2 - x1, z2 - z1)
    if (largo < 0.01) return
    posicion.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2)
    giro.setFromAxisAngle(arriba, -Math.atan2(z2 - z1, x2 - x1))
    escala.set(largo + ANCHO_MARCA * 0.5, 1, ANCHO_MARCA)
    marcas.setMatrixAt(cabezaMarcas, matriz.compose(posicion, giro, escala))
    cabezaMarcas = (cabezaMarcas + 1) % MAX_MARCAS
    marcas.instanceMatrix.needsUpdate = true
  }

  function emitir(x, z, vx, vz, tono, tamano) {
    const i = cabezaPuffs
    cabezaPuffs = (cabezaPuffs + 1) % MAX_PUFFS
    const vida = 0.5 + Math.random() * 0.6
    const existente = vivos.findIndex((p) => p.i === i)
    if (existente >= 0) vivos.splice(existente, 1)
    vivos.push({
      i,
      x,
      y: 0.4,
      z,
      vx: vx * 0.2 + (Math.random() - 0.5) * 3,
      vy: 0.8 + Math.random() * 1.2,
      vz: vz * 0.2 + (Math.random() - 0.5) * 3,
      tamano,
      vida,
      max: vida,
    })
    puffs.setColorAt(i, color.set(tono))
    puffs.instanceColor.needsUpdate = true
  }

  return {
    /** Call once per physics tick for each car */
    registrar(id, carro) {
      const v = Math.hypot(carro.vx, carro.vy)
      const c = Math.cos(carro.angulo)
      const s = Math.sin(carro.angulo)
      const traseras = [-1, 1].map((lado) => [carro.x - c * 1.35 - s * 1.02 * lado, carro.y - s * 1.35 + c * 1.02 * lado])

      const marca = v > 2 && (carro.derrape > 0.3 || (carro.suelo === 'tierra' && v > 6))
      const antes = ruedas.get(id)
      if (marca && antes) traseras.forEach(([x, z], i) => agregarMarca(antes[i][0], antes[i][1], x, z))
      ruedas.set(id, marca ? traseras : null)

      const [x, z] = traseras[Math.floor(Math.random() * 2)]
      if (carro.suelo === 'tierra' && v > 3 && Math.random() < 0.7) {
        emitir(x, z, -carro.vx, -carro.vy, COLORES.polvo, 0.6 + Math.random() * 0.5)
      } else if (carro.derrape > 0.55 && v > 8 && Math.random() < 0.5) {
        emitir(x, z, -carro.vx, -carro.vy, COLORES.humo, 0.45 + Math.random() * 0.4)
      }
    },

    olvidar(id) {
      ruedas.delete(id)
    },

    actualizar(dt) {
      for (let k = vivos.length - 1; k >= 0; k--) {
        const p = vivos[k]
        p.vida -= dt
        if (p.vida <= 0) {
          puffs.setMatrixAt(p.i, cero)
          vivos.splice(k, 1)
          continue
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        p.vx *= 1 - 2 * dt
        p.vz *= 1 - 2 * dt
        // Grows fast, then shrinks to nothing
        const t = 1 - p.vida / p.max
        const r = p.tamano * (0.6 + t * 1.6) * Math.min(1, (1 - t) * 3)
        posicion.set(p.x, p.y, p.z)
        escala.setScalar(r)
        puffs.setMatrixAt(p.i, matriz.compose(posicion, giro.identity(), escala))
      }
      puffs.instanceMatrix.needsUpdate = true
    },

    limpiar() {
      for (let i = 0; i < MAX_MARCAS; i++) marcas.setMatrixAt(i, cero)
      marcas.instanceMatrix.needsUpdate = true
      for (const p of vivos) puffs.setMatrixAt(p.i, cero)
      vivos.length = 0
      ruedas.clear()
    },
  }
}
