import * as THREE from 'three'
import { COLORES } from '../render/colores.js'
import { pieza } from './materiales.js'

/**
 * Low-poly car, 4.4 × 2.2 m like the physics. In the car's own space +X is forward and +Z is
 * its right side, so `rotation.y = -angulo` lines it up with the physics (x, y) → world (x, z).
 * The body sits in its own group so it can lean in the turns while the wheels stay down.
 */
export function crearCarro3D(color) {
  const grupo = new THREE.Group()
  const cuerpo = new THREE.Group()
  grupo.add(cuerpo)

  const chasis = pieza(new THREE.BoxGeometry(4.3, 0.75, 2.1), color)
  chasis.position.y = 0.78
  const cabina = pieza(new THREE.BoxGeometry(2, 0.66, 1.8), '#2E2016', { grosor: 0.05 })
  cabina.position.set(-0.35, 1.48, 0)
  const techo = pieza(new THREE.BoxGeometry(1.75, 0.14, 1.7), color, { grosor: 0.05 })
  techo.position.set(-0.4, 1.86, 0)
  const franja = pieza(new THREE.BoxGeometry(4.32, 0.04, 0.4), COLORES.crema, { grosor: 0.02, sombra: false })
  franja.position.y = 1.17
  cuerpo.add(chasis, cabina, techo, franja)

  for (const z of [-0.65, 0.65]) {
    const faro = pieza(new THREE.BoxGeometry(0.08, 0.2, 0.4), COLORES.crema, { grosor: 0.03, sombra: false })
    faro.position.set(2.16, 0.9, z)
    const calavera = pieza(new THREE.BoxGeometry(0.08, 0.18, 0.45), '#9E2A14', { grosor: 0.03, sombra: false })
    calavera.position.set(-2.16, 0.92, z)
    cuerpo.add(faro, calavera)
  }

  const ruedaGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.42, 12).rotateX(Math.PI / 2)
  const delanteras = []
  for (const [x, z] of [[1.35, -1.02], [1.35, 1.02], [-1.35, -1.02], [-1.35, 1.02]]) {
    const rueda = pieza(ruedaGeo, COLORES.tinta, { grosor: 0.04 })
    rueda.position.set(x, 0.46, z)
    grupo.add(rueda)
    if (x > 0) delanteras.push(rueda)
  }

  return { grupo, cuerpo, delanteras }
}

/** Places the car from its physics state and adds a bit of lean (render only) */
export function ponerCarro(carro3d, estado) {
  const { grupo, cuerpo, delanteras } = carro3d
  grupo.position.set(estado.x, 0, estado.y)
  grupo.rotation.y = -estado.angulo
  // Lean out of the turn, more when sliding
  const inclinacion = Math.max(-0.12, Math.min(0.12, estado.w * 0.035 * (1 + estado.derrape)))
  cuerpo.rotation.x = inclinacion
  // Front wheels point where the car is turning
  for (const rueda of delanteras) rueda.rotation.y = -Math.max(-0.5, Math.min(0.5, estado.w * 0.2))
}
