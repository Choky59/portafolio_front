import * as THREE from 'three'
import { PARAMETROS_CAMARA } from '../compartido/camara'
import { crearCarro3D, ponerCarro } from './carro.js'
import { crearEfectos3D } from './efectos.js'
import { crearMundo } from './mundo.js'

const CIELO = '#F3E2BC'

/**
 * The game's 3D view. It knows nothing about rules or network: every frame it gets the cars'
 * states and the shared camera (compartido/camara.ts) and draws them.
 */
export function crearEscena3D(canvas, pista) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const escena = new THREE.Scene()
  escena.background = new THREE.Color(CIELO)
  escena.fog = new THREE.Fog(CIELO, 140, 420)

  const camara = new THREE.PerspectiveCamera(PARAMETROS_CAMARA.fov, 16 / 9, 0.5, 900)

  // Warm afternoon sun from the west; its shadow box follows the camera
  escena.add(new THREE.HemisphereLight('#FFF4DC', '#B48A57', 1.5))
  const sol = new THREE.DirectionalLight('#FFE7BC', 2.2)
  sol.castShadow = true
  sol.shadow.mapSize.set(2048, 2048)
  Object.assign(sol.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 200 })
  sol.shadow.bias = -0.0005
  sol.shadow.normalBias = 0.03
  escena.add(sol, sol.target)
  const DIRECCION_SOL = new THREE.Vector3(-40, 70, 30)

  escena.add(crearMundo(pista, renderer))
  const efectos = crearEfectos3D(escena)
  const carros = new Map()

  const foco = new THREE.Vector3()
  const mira = new THREE.Vector3()

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

    limpiarEfectos() {
      efectos.limpiar()
    },

    /**
     * Draws a frame. `estados` = [{ id, estado }] (already interpolated), `cam` = shared camera.
     * The drone sits `distancia` m behind the followed point along the camera's heading,
     * `altura` m up, and looks at a point `mira` m ahead of it.
     */
    dibujar(estados, cam, dt) {
      ajustarTamano()
      for (const { id, estado } of estados) {
        const carro = carros.get(id)
        if (carro) ponerCarro(carro, estado)
      }
      efectos.actualizar(dt)

      const p = PARAMETROS_CAMARA
      const dx = Math.cos(cam.rumbo)
      const dz = Math.sin(cam.rumbo)
      foco.set(cam.x, 0, cam.y)
      camara.position.set(cam.x - dx * p.distancia, p.altura, cam.y - dz * p.distancia)
      mira.set(cam.x + dx * p.mira, 0, cam.y + dz * p.mira)
      camara.lookAt(mira)

      sol.target.position.copy(mira)
      sol.position.copy(mira).add(DIRECCION_SOL)

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
