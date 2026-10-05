import { acercar, crearSaguaro, crearSol, crearTermometro, luces, material, rng } from '../piezas.js'

/**
 * Cover for Proyecto #1: sun, saguaro and thermometer on a small island of desert.
 * Gentle orbit + tilt toward the pointer; the thermometer is in the "extreme" state.
 */
export default function crearPortadaSePuedeSalir() {
  let camera, grupo, sol, termometro
  let inclinacion = 0

  return {
    tiempoEstatico: 1.5,

    setup(ctx) {
      const { THREE, scene, paleta } = ctx
      camera = ctx.camera
      luces(THREE, scene, paleta)

      grupo = new THREE.Group()
      scene.add(grupo)

      const isla = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.6, 9), material(THREE, paleta.suelo))
      isla.position.y = -0.3
      grupo.add(isla)

      const saguaro = crearSaguaro(THREE, paleta.saguaro, rng(5))
      saguaro.position.set(-1.2, 0, -0.3)
      grupo.add(saguaro)

      termometro = crearTermometro(THREE, paleta)
      termometro.grupo.position.set(1.4, 0.4, 0.4)
      termometro.grupo.scale.setScalar(0.8)
      termometro.setNivel(0.92)
      termometro.setColor(paleta.extremo)
      grupo.add(termometro.grupo)

      sol = crearSol(THREE, paleta.accent)
      sol.grupo.position.set(1.8, 4.2, -3)
      sol.grupo.scale.setScalar(0.9)
      scene.add(sol.grupo)

      camera.position.set(0, 2.6, 8.5)
      camera.lookAt(0, 1.6, 0)
    },

    update(dt, t, input) {
      inclinacion = acercar(inclinacion, input.x * 0.35, dt || 1, 3)
      grupo.rotation.y = Math.sin(t * 0.3) * 0.25 + inclinacion
      sol.halo.scale.setScalar(1 + Math.sin(t * 1.8) * 0.06)
      sol.nucleo.rotation.y = t * 0.2
      termometro.setNivel(0.88 + Math.sin(t * 2) * 0.03)
    },
  }
}
