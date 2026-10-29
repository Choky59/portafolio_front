import * as THREE from 'three'
import { PARAMETROS_CAMARA, poseCamara } from '../compartido/camara'
import { alturaEn } from '../compartido/pista'
import { crearCarro3D, ponerCarro } from './carro.js'
import { crearEfectos3D } from './efectos.js'
import { crearCaja, crearModeloEntidad } from './entidades.js'
import { crearMundo } from './mundo.js'

const CIELO = '#F3E2BC'

/**
 * The game's 3D view. It knows nothing about rules or network: every frame it gets the cars'
 * states and a camera (compartido/camara.ts) and draws them. The camera pose comes from
 * poseCamara(), the same math the server uses to decide who's out of the picture.
 */
export function crearEscena3D(canvas, pista, { items = [] } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const escena = new THREE.Scene()
  escena.background = new THREE.Color(CIELO)
  escena.fog = new THREE.Fog(CIELO, 160, 480)

  const camara = new THREE.PerspectiveCamera(PARAMETROS_CAMARA.fov, 16 / 9, 0.5, 1000)

  // Warm afternoon sun from the west; its shadow box follows the camera
  escena.add(new THREE.HemisphereLight('#FFF4DC', '#B48A57', 1.5))
  const sol = new THREE.DirectionalLight('#FFE7BC', 2.2)
  sol.castShadow = true
  sol.shadow.mapSize.set(2048, 2048)
  // Big enough for the shared camera zoomed out to double
  Object.assign(sol.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 320 })
  sol.shadow.bias = -0.0005
  sol.shadow.normalBias = 0.03
  escena.add(sol, sol.target)
  const DIRECCION_SOL = new THREE.Vector3(-50, 90, 40)

  const altura = (x, y) => alturaEn(pista, x, y)
  escena.add(crearMundo(pista, renderer))
  const efectos = crearEfectos3D(escena, altura)
  const carros = new Map()

  // Item boxes, spinning and bobbing over the road (hidden while switched off)
  const cajas = pista.circuito.cajas.map(([x, y]) => {
    const caja = crearCaja()
    caja.position.set(x, altura(x, y) + 1.4, y)
    escena.add(caja)
    return caja
  })
  /** What's loose on the road: entity id → { modelo, item } */
  const entidades = new Map()

  const arriba = new THREE.Vector3(0, 1, 0)
  const normal = new THREE.Vector3()
  const inclinacion = new THREE.Quaternion()
  const giro = new THREE.Quaternion()

  /**
   * Lays something flat on the ground (a pothole, a puddle, a speed bump), `tamano` meters
   * around its center: tilted with the slope measured at that distance, then lifted just enough
   * that no point around it is under the ground (hills curve, a flat piece doesn't).
   */
  function acostar(grupo, e, tamano) {
    const h = altura(e.x, e.y)
    const pendienteX = (altura(e.x + tamano, e.y) - altura(e.x - tamano, e.y)) / (2 * tamano)
    const pendienteZ = (altura(e.x, e.y + tamano) - altura(e.x, e.y - tamano)) / (2 * tamano)
    let hundido = 0
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      for (const d of [tamano * 0.5, tamano]) {
        const dx = Math.cos(a) * d
        const dz = Math.sin(a) * d
        hundido = Math.max(hundido, altura(e.x + dx, e.y + dz) - (h + pendienteX * dx + pendienteZ * dz))
      }
    }
    normal.set(-pendienteX, 1, -pendienteZ).normalize()
    inclinacion.setFromUnitVectors(arriba, normal)
    giro.setFromAxisAngle(arriba, -e.angulo)
    grupo.quaternion.copy(inclinacion).multiply(giro)
    grupo.position.set(e.x, h + hundido + 0.06, e.y)
  }

  function ajustarTamano() {
    const ancho = canvas.clientWidth
    const alto = canvas.clientHeight
    if (!ancho || !alto) return
    const actual = renderer.getSize(new THREE.Vector2())
    if (actual.x !== ancho || actual.y !== alto) {
      renderer.setSize(ancho, alto, false)
      camara.aspect = ancho / alto
      camara.updateProjectionMatrix()
    }
  }

  return {
    agregarCarro(id, color) {
      const carro = crearCarro3D(color)
      carros.set(id, carro)
      escena.add(carro.grupo)
    },

    quitarCarro(id) {
      const carro = carros.get(id)
      if (carro) escena.remove(carro.grupo)
      carros.delete(id)
      efectos.olvidar(id)
    },

    /** Once per physics tick: tire marks and dust come from the simulated states */
    registrarEfectos(id, estado) {
      efectos.registrar(id, estado)
    },

    explotar(x, y) {
      efectos.explosion(x, y)
    },

    impacto(x, y, color) {
      efectos.impacto(x, y, color)
    },

    /** Boxes switched off (indices) */
    ponerCajas(apagadas) {
      cajas.forEach((caja, i) => (caja.visible = !apagadas.has(i)))
    },

    /** Loose items: [{ id, item, x, y, angulo, vida }] (already interpolated) */
    ponerEntidades(lista) {
      const vistas = new Set()
      const t = performance.now() / 1000
      for (const e of lista) {
        vistas.add(e.id)
        let actual = entidades.get(e.id)
        if (!actual) {
          const item = items[e.item]
          if (!item) continue
          actual = crearModeloEntidad(item)
          entidades.set(e.id, actual)
          escena.add(actual.grupo)
        }
        if (actual.sobreSuelo) acostar(actual.grupo, e, actual.sobreSuelo)
        else {
          actual.grupo.position.set(e.x, altura(e.x, e.y), e.y)
          actual.grupo.rotation.y = -e.angulo
        }
        actual.animar?.(t, e.vida)
      }
      for (const [id, actual] of entidades) {
        if (vistas.has(id)) continue
        escena.remove(actual.grupo)
        entidades.delete(id)
      }
    },

    limpiarEfectos() {
      efectos.limpiar()
    },

    /**
     * Draws a frame. `estados` = [{ id, estado }] (already interpolated); cars not listed are
     * hidden (out of the round). `cam` = a camera from compartido/camara.ts, `p` its parameters.
     */
    dibujar(estados, cam, dt, p = PARAMETROS_CAMARA) {
      ajustarTamano()
      for (const carro of carros.values()) carro.grupo.visible = false
      for (const { id, estado } of estados) {
        const carro = carros.get(id)
        if (!carro) continue
        carro.grupo.visible = true
        ponerCarro(carro, estado, altura)
      }
      efectos.actualizar(dt)
      const t = performance.now() / 1000
      cajas.forEach((caja, i) => {
        caja.rotation.set(0.4, t * 1.6 + i, 0.3)
        caja.position.y = altura(caja.position.x, caja.position.z) + 1.4 + Math.sin(t * 3 + i) * 0.25
      })

      if (camara.fov !== p.fov) {
        camara.fov = p.fov
        camara.updateProjectionMatrix()
      }
      const { posicion, mira } = poseCamara(cam, p)
      camara.position.set(...posicion)
      camara.lookAt(...mira)

      sol.target.position.set(...mira)
      sol.position.set(...mira).add(DIRECCION_SOL)

      renderer.render(escena, camara)
    },

    destruir() {
      escena.traverse((o) => {
        o.geometry?.dispose()
        const materiales = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
        for (const m of materiales) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose()
          m.dispose()
        }
      })
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
