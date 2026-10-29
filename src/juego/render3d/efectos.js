import * as THREE from 'three'
import { COLORES } from '../render/colores.js'
import { toon } from './materiales.js'

/**
 * Things that only exist on screen: tire marks, puffs of dust and smoke, and explosions.
 * They never affect the game, so each client makes its own from the cars' state and events.
 * All of them are instanced meshes used as ring buffers: one draw call each.
 * `altura(x, y)` is the ground height, so everything sits on the hills.
 */
const MAX_MARCAS = 2000
const MAX_PUFFS = 320
const MAX_ESCOMBROS = 60
const MAX_QUEMADAS = 16
const ANCHO_MARCA = 0.32
const GRAVEDAD = 22

export function crearEfectos3D(escena, altura = () => 0) {
  const matriz = new THREE.Matrix4()
  const posicion = new THREE.Vector3()
  const giro = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const escala = new THREE.Vector3()
  const arriba = new THREE.Vector3(0, 1, 0)
  const cero = new THREE.Matrix4().makeScale(0, 0, 0)
  const color = new THREE.Color()

  function anillo(geo, material, cuantos) {
    const malla = new THREE.InstancedMesh(geo, material, cuantos)
    malla.frustumCulled = false
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    for (let i = 0; i < cuantos; i++) malla.setMatrixAt(i, cero)
    escena.add(malla)
    return malla
  }

  const plano = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const sobreSuelo = (opacidad) =>
    new THREE.MeshBasicMaterial({
      color: COLORES.tinta,
      transparent: true,
      opacity: opacidad,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })

  const marcas = anillo(plano, sobreSuelo(0.4), MAX_MARCAS)
  let cabezaMarcas = 0
  const quemadas = anillo(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), sobreSuelo(0.55), MAX_QUEMADAS)
  let cabezaQuemadas = 0

  // Puffs: faceted balls that grow and then shrink away (dust, smoke, fire)
  const puffs = anillo(new THREE.IcosahedronGeometry(1, 0), toon('#ffffff'), MAX_PUFFS)
  for (let i = 0; i < MAX_PUFFS; i++) puffs.setColorAt(i, color.set(COLORES.humo))
  const vivos = []
  let cabezaPuffs = 0

  // Debris: little boxes in the car's colors flying off an explosion
  const escombros = anillo(new THREE.BoxGeometry(0.5, 0.35, 0.6), toon('#ffffff'), MAX_ESCOMBROS)
  for (let i = 0; i < MAX_ESCOMBROS; i++) escombros.setColorAt(i, color.set(COLORES.tinta))
  const volando = []
  let cabezaEscombros = 0

  /** Last rear wheel positions per car, or null when it isn't leaving marks */
  const ruedas = new Map()

  function agregarMarca(x1, z1, x2, z2) {
    const largo = Math.hypot(x2 - x1, z2 - z1)
    if (largo < 0.01) return
    const mx = (x1 + x2) / 2
    const mz = (z1 + z2) / 2
    posicion.set(mx, altura(mx, mz) + 0.03, mz)
    giro.setFromAxisAngle(arriba, -Math.atan2(z2 - z1, x2 - x1))
    escala.set(largo + ANCHO_MARCA * 0.5, 1, ANCHO_MARCA)
    marcas.setMatrixAt(cabezaMarcas, matriz.compose(posicion, giro, escala))
    cabezaMarcas = (cabezaMarcas + 1) % MAX_MARCAS
    marcas.instanceMatrix.needsUpdate = true
  }

  function emitir({ x, z, y = altura(x, z) + 0.4, vx = 0, vy = 1, vz = 0, tono, tamano, vida = 0.5 + Math.random() * 0.6 }) {
    const i = cabezaPuffs
    cabezaPuffs = (cabezaPuffs + 1) % MAX_PUFFS
    const existente = vivos.findIndex((p) => p.i === i)
    if (existente >= 0) vivos.splice(existente, 1)
    vivos.push({ i, x, y, z, vx, vy, vz, tamano, vida, max: vida })
    puffs.setColorAt(i, color.set(tono))
    puffs.instanceColor.needsUpdate = true
  }

  function polvo(x, z, vx, vz, tono, tamano) {
    emitir({
      x,
      z,
      vx: vx * 0.2 + (Math.random() - 0.5) * 3,
      vy: 0.8 + Math.random() * 1.2,
      vz: vz * 0.2 + (Math.random() - 0.5) * 3,
      tono,
      tamano,
    })
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
      // Item effects leave their own trail: splashes when slipping, heat when slowed
      if (carro.resbalon > 0 && v > 2 && Math.random() < 0.8) {
        polvo(x, z, -carro.vx, -carro.vy, '#8EC3E3', 0.4 + Math.random() * 0.4)
      } else if (carro.lento > 0 && Math.random() < 0.6) {
        emitir({ x: carro.x, z: carro.y, vy: 3, tono: Math.random() < 0.5 ? '#F4B33A' : '#E4572E', tamano: 0.35, vida: 0.6 })
      } else if (carro.suelo === 'tierra' && v > 3 && Math.random() < 0.7) {
        polvo(x, z, -carro.vx, -carro.vy, COLORES.polvo, 0.6 + Math.random() * 0.5)
      } else if (carro.derrape > 0.55 && v > 8 && Math.random() < 0.5) {
        polvo(x, z, -carro.vx, -carro.vy, COLORES.humo, 0.45 + Math.random() * 0.4)
      }
    },

    /** Boom: fire and ink puffs, flying debris and a scorch mark left on the ground */
    explosion(x, z) {
      const h = altura(x, z)
      for (let k = 0; k < 34; k++) {
        const a = Math.random() * Math.PI * 2
        const v = 3 + Math.random() * 9
        emitir({
          x,
          z,
          y: h + 0.6 + Math.random(),
          vx: Math.cos(a) * v,
          vy: 2 + Math.random() * 7,
          vz: Math.sin(a) * v,
          tono: ['#F6C445', '#F4B33A', '#E4572E', '#E4572E', COLORES.tinta][k % 5],
          tamano: 0.8 + Math.random() * 1.4,
          vida: 0.5 + Math.random() * 0.7,
        })
      }
      for (let k = 0; k < 10; k++) {
        const i = cabezaEscombros
        cabezaEscombros = (cabezaEscombros + 1) % MAX_ESCOMBROS
        const a = Math.random() * Math.PI * 2
        const v = 5 + Math.random() * 8
        const existente = volando.findIndex((e) => e.i === i)
        if (existente >= 0) volando.splice(existente, 1)
        volando.push({ i, x, y: h + 1, z, vx: Math.cos(a) * v, vy: 6 + Math.random() * 8, vz: Math.sin(a) * v, r: 0, vida: 1.6 })
        escombros.setColorAt(i, color.set(k % 3 ? COLORES.tinta : '#9A8B78'))
      }
      escombros.instanceColor.needsUpdate = true
      posicion.set(x, h + 0.04, z)
      escala.set(4.5, 1, 4.5)
      quemadas.setMatrixAt(cabezaQuemadas, matriz.compose(posicion, giro.identity(), escala))
      cabezaQuemadas = (cabezaQuemadas + 1) % MAX_QUEMADAS
      quemadas.instanceMatrix.needsUpdate = true
    },

    /** An item hit someone: a small burst in the item's color */
    impacto(x, z, tono) {
      for (let k = 0; k < 12; k++) {
        const a = Math.random() * Math.PI * 2
        const v = 2 + Math.random() * 5
        emitir({ x, z, y: altura(x, z) + 1, vx: Math.cos(a) * v, vy: 2 + Math.random() * 4, vz: Math.sin(a) * v, tono: k % 3 ? tono : COLORES.crema, tamano: 0.5 + Math.random() * 0.5, vida: 0.4 + Math.random() * 0.3 })
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
        p.vy *= 1 - 1.5 * dt
        p.vz *= 1 - 2 * dt
        // Grows fast, then shrinks to nothing
        const t = 1 - p.vida / p.max
        const r = p.tamano * (0.6 + t * 1.6) * Math.min(1, (1 - t) * 3)
        posicion.set(p.x, p.y, p.z)
        escala.setScalar(r)
        puffs.setMatrixAt(p.i, matriz.compose(posicion, giro.identity(), escala))
      }
      puffs.instanceMatrix.needsUpdate = true

      for (let k = volando.length - 1; k >= 0; k--) {
        const e = volando[k]
        e.vida -= dt
        if (e.vida <= 0) {
          escombros.setMatrixAt(e.i, cero)
          volando.splice(k, 1)
          continue
        }
        e.vy -= GRAVEDAD * dt
        e.x += e.vx * dt
        e.y += e.vy * dt
        e.z += e.vz * dt
        const suelo = altura(e.x, e.z) + 0.2
        if (e.y < suelo) {
          // Bounce and slide to a stop
          e.y = suelo
          e.vy *= -0.3
          e.vx *= 0.6
          e.vz *= 0.6
        }
        e.r += dt * 9
        posicion.set(e.x, e.y, e.z)
        giro.setFromEuler(euler.set(e.r, e.r * 0.7, 0))
        escala.setScalar(Math.min(1, e.vida * 2))
        escombros.setMatrixAt(e.i, matriz.compose(posicion, giro, escala))
      }
      escombros.instanceMatrix.needsUpdate = true
    },

    limpiar() {
      for (const malla of [marcas, quemadas]) {
        for (let i = 0; i < malla.count; i++) malla.setMatrixAt(i, cero)
        malla.instanceMatrix.needsUpdate = true
      }
      for (const p of vivos) puffs.setMatrixAt(p.i, cero)
      for (const e of volando) escombros.setMatrixAt(e.i, cero)
      vivos.length = 0
      volando.length = 0
      ruedas.clear()
    },
  }
}
