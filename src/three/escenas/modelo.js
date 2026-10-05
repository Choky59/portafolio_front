import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { luces } from '../piezas.js'

/**
 * Interactive viewer for the device .glb (exported from Fusion).
 * params: { src: string, onEstado?: (estado: 'cargando' | 'listo' | 'error') => void }
 */
export default function crearVisorModelo() {
  let controls
  let cancelado = false

  return {
    tiempoEstatico: 0,

    setup(ctx) {
      const { THREE, scene, camera, canvas, paleta, params, reducedMotion, requestRender } = ctx
      luces(THREE, scene, paleta)

      controls = new OrbitControls(camera, canvas)
      controls.enableDamping = true
      controls.enablePan = false
      controls.autoRotate = !reducedMotion
      controls.autoRotateSpeed = 1.2
      controls.addEventListener('change', requestRender)

      camera.position.set(3, 2, 4)

      params.onEstado?.('cargando')
      new GLTFLoader().load(
        params.src,
        (gltf) => {
          if (cancelado) return
          const modelo = gltf.scene

          // Center and fit whatever units the CAD export used
          const caja = new THREE.Box3().setFromObject(modelo)
          const tamano = caja.getSize(new THREE.Vector3()).length() || 1
          const centro = caja.getCenter(new THREE.Vector3())
          modelo.position.sub(centro)
          const escala = 3 / tamano
          modelo.scale.setScalar(escala)
          modelo.position.multiplyScalar(escala)
          scene.add(modelo)

          controls.minDistance = 2
          controls.maxDistance = 9
          controls.update()
          requestRender()
          params.onEstado?.('listo')
        },
        undefined,
        () => {
          if (!cancelado) params.onEstado?.('error')
        }
      )
    },

    update() {
      controls.update()
    },

    dispose() {
      cancelado = true
      controls?.dispose()
    },
  }
}
