import {
  acercar,
  crearMontanas,
  crearSaguaro,
  crearSol,
  crearSuelo,
  crearTermometro,
  luces,
  rng,
} from '../piezas.js'
import { colorPorTemperatura } from '../paleta.js'

/**
 * Home hero: low-poly Sonoran desert. The camera follows the pointer (parallax)
 * and the thermometer cycles through the four "¿se puede salir?" states.
 */
export default function crearDesierto() {
  let camera, sol, termometro, paleta
  const camPos = { x: 0, y: 2.4 }

  return {
    tiempoEstatico: 4,

    setup(ctx) {
      const { THREE, scene } = ctx
      camera = ctx.camera
      paleta = ctx.paleta
      const random = rng(11)

      luces(THREE, scene, paleta)
      scene.fog = new THREE.Fog(paleta.bg, 12, 30)

      scene.add(crearSuelo(THREE, paleta.suelo))
      scene.add(crearMontanas(THREE, paleta.montana))

      sol = crearSol(THREE, paleta.accent)
      sol.grupo.position.set(4.5, 5.2, -9)
      sol.grupo.scale.setScalar(1.4)
      scene.add(sol.grupo)

      const saguaros = [
        { x: -4.2, z: -1.5, s: 1.1 },
        { x: -1.8, z: -5, s: 0.8 },
        { x: 6.5, z: -4, s: 0.9 },
        { x: -7.5, z: -6, s: 0.7 },
      ]
      for (const { x, z, s } of saguaros) {
        const saguaro = crearSaguaro(THREE, paleta.saguaro, random)
        saguaro.position.set(x, 0, z)
        saguaro.scale.setScalar(s)
        saguaro.rotation.y = random() * Math.PI
        scene.add(saguaro)
      }

      termometro = crearTermometro(THREE, paleta)
      termometro.grupo.position.set(2.6, 0.4, 0.5)
      termometro.grupo.rotation.z = -0.08
      scene.add(termometro.grupo)

      camera.fov = 45
      camera.position.set(0, camPos.y, 9)
      camera.lookAt(0, 1.6, 0)
    },

    update(dt, t, input) {
      // Parallax: camera eases toward the pointer, sinks a bit with scroll
      camPos.x = acercar(camPos.x, input.x * 0.9, dt || 1, 2.5)
      camPos.y = acercar(camPos.y, 2.4 + input.y * 0.35 - input.scroll * 0.8, dt || 1, 2.5)
      camera.position.x = camPos.x
      camera.position.y = camPos.y
      camera.lookAt(0, 1.6, 0)

      sol.nucleo.rotation.y = t * 0.15
      sol.halo.scale.setScalar(1 + Math.sin(t * 1.5) * 0.05)

      // 15 °C → 45 °C and back, about every 16 s
      const temperatura = 30 + Math.sin(t * 0.4) * 15
      termometro.setNivel((temperatura - 10) / 40)
      termometro.setColor(colorPorTemperatura(temperatura, paleta))
    },
  }
}
