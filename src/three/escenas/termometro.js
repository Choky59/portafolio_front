import { acercar, crearTermometro, luces } from '../piezas.js'

const MIN = 5
const MAX = 50

/**
 * Live dashboard thermometer.
 * params: { temperatura: number | null, color: css color }
 * The liquid eases toward the new value instead of jumping.
 */
export default function crearTermometroEnVivo() {
  let termometro
  let nivel = 0
  let objetivo = 0
  let color = null

  function aplicar(params) {
    if (typeof params?.temperatura === 'number') {
      objetivo = (params.temperatura - MIN) / (MAX - MIN)
    }
    if (params?.color && params.color !== color) {
      color = params.color
      termometro.setColor(color)
    }
  }

  return {
    tiempoEstatico: 0,

    setup(ctx) {
      const { THREE, scene, camera, paleta, params } = ctx
      luces(THREE, scene, paleta)

      termometro = crearTermometro(THREE, paleta)
      termometro.grupo.position.y = -1.5
      termometro.setNivel(0)
      scene.add(termometro.grupo)

      aplicar({ color: paleta.calor, ...params })

      camera.position.set(0, 0.5, 6.5)
      camera.lookAt(0, 0.4, 0)
    },

    setParams(params) {
      aplicar(params)
    },

    update(dt, t) {
      // dt = 0 is a static frame (reduced motion / outside the loop): jump to the value
      nivel = dt ? acercar(nivel, objetivo, dt, 2) : objetivo
      termometro.setNivel(nivel)
      termometro.grupo.rotation.y = Math.sin(t * 0.6) * 0.35
    },
  }
}
