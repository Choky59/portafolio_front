import * as THREE from 'three'
import { COLORES } from '../render/colores.js'
import { DECORACION } from './decoracion.js'
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
  const ruedas = []
  for (const [x, z] of [[1.35, -1.02], [1.35, 1.02], [-1.35, -1.02], [-1.35, 1.02]]) {
    const rueda = pieza(ruedaGeo, COLORES.tinta, { grosor: 0.04 })
    rueda.position.set(x, 0.46, z)
    grupo.add(rueda)
    ruedas.push(rueda)
    if (x > 0) delanteras.push(rueda)
  }

  // El camión urbano (turbo): the car turns into a bus for a while, with the player's color on top
  const camion = DECORACION.camion(0.55)
  const techoCamion = pieza(new THREE.BoxGeometry(5.6, 0.12, 1.2), color, { grosor: 0.03, sombra: false })
  techoCamion.position.y = 2.15
  camion.add(techoCamion)
  camion.visible = false
  grupo.add(camion)

  // Stunned: little stars spinning over the roof
  const estrellas = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const estrella = pieza(new THREE.OctahedronGeometry(0.28, 0), '#F6C445', { grosor: 0.03, sombra: false })
    const a = (i / 3) * Math.PI * 2
    estrella.position.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1)
    estrellas.add(estrella)
  }
  estrellas.position.y = 2.7
  estrellas.visible = false
  grupo.add(estrellas)

  return { grupo, cuerpo, delanteras, ruedas, camion, estrellas }
}

/**
 * Places the car from its physics state on the ground (which can have hills), pitched and
 * rolled with the slope, and adds a bit of lean in the turns (render only).
 */
export function ponerCarro(carro3d, estado, altura = () => 0) {
  const { grupo, cuerpo, delanteras } = carro3d
  const { x, y, angulo } = estado
  const c = Math.cos(angulo)
  const s = Math.sin(angulo)
  // Slope under the car: height difference between nose and tail, and between both sides
  const frente = altura(x + c * 1.6, y + s * 1.6) - altura(x - c * 1.6, y - s * 1.6)
  const lado = altura(x - s * 0.9, y + c * 0.9) - altura(x + s * 0.9, y - c * 0.9)
  // `altura` includes the ramps, so up a ramp the car follows it. In the air (off a ramp, rampa
  // -1 and z > 0) it's up by z, nose up while rising and down while falling
  const volando = (estado.z ?? 0) > 0 && (estado.rampa ?? -1) < 0
  grupo.position.set(x, altura(x, y) + (volando ? estado.z : 0), y)
  const cabeceo = volando ? Math.atan2(estado.vz ?? 0, Math.hypot(estado.vx, estado.vy) || 1) * 0.8 : Math.atan2(frente, 3.2)
  // YXZ: heading first, then roll on the car's length (+X) and pitch on its width (+Z, its right)
  grupo.rotation.set(volando ? 0 : -Math.atan2(lado, 1.8), -angulo, cabeceo, 'YXZ')
  // Lean out of the turn, more when sliding
  const inclinacion = Math.max(-0.12, Math.min(0.12, estado.w * 0.035 * (1 + estado.derrape)))
  cuerpo.rotation.x = inclinacion
  // Front wheels point where the car is turning
  for (const rueda of delanteras) rueda.rotation.y = -Math.max(-0.5, Math.min(0.5, estado.w * 0.2))

  // Item effects that show on the car
  const turbo = estado.turbo > 0
  carro3d.camion.visible = turbo
  cuerpo.visible = !turbo
  for (const rueda of carro3d.ruedas) rueda.visible = !turbo
  carro3d.estrellas.visible = estado.aturdido > 0
  if (estado.aturdido > 0) carro3d.estrellas.rotation.y = performance.now() / 150
}
