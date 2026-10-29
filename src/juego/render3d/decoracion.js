import * as THREE from 'three'
import { crearSaguaro } from '../../three/piezas.js'
import { COLORES } from '../render/colores.js'
import { conContorno, pieza, toon } from './materiales.js'

/**
 * 3D props of the map, by `tipo` in the circuit JSON: each one gets (escala, random) and returns
 * a group standing on y = 0 whose front faces +z (rotation 0 = facing south). Low-poly toon pieces
 * with ink outline, like the cars. Adding a new prop is adding an entry here.
 */

/** A piece placed at x, y, z inside a group */
function en(grupo, geo, color, x, y, z, opciones) {
  const p = pieza(geo, color, opciones)
  p.position.set(x, y, z)
  grupo.add(p)
  return p
}

const BLANCO = '#F3EDE0'
const CANTERA = '#E2D3B8'

export const DECORACION = {
  saguaro(escala, random) {
    const saguaro = crearSaguaro(THREE, COLORES.saguaro, random)
    saguaro.scale.setScalar(2.3 * escala)
    // Collect first: adding outlines while traversing would visit the outlines too
    const mallas = []
    saguaro.traverse((o) => o.isMesh && mallas.push(o))
    for (const o of mallas) {
      o.material = toon(COLORES.saguaro)
      o.castShadow = true
      conContorno(o, 0.05)
    }
    return saguaro
  },

  piedra(escala, random) {
    const grupo = new THREE.Group()
    const geo = new THREE.IcosahedronGeometry(1.6 * escala, 0).scale(1, 0.55 + random() * 0.3, 1)
    en(grupo, geo, COLORES.piedra, 0, 0.3, 0, { grosor: 0.08 })
    return grupo
  },

  /** Catedral de la Asunción: white neoclassical front, two bell towers and a dome behind */
  catedral(escala) {
    const g = new THREE.Group()
    en(g, new THREE.BoxGeometry(30, 11, 26), BLANCO, 0, 5.5, -2, { grosor: 0.12 })
    // Triangular pediment: a 3-sided prism facing front, one corner up, flattened
    en(g, new THREE.CylinderGeometry(8.5, 8.5, 1, 3).rotateX(-Math.PI / 2).scale(1, 0.45, 1), CANTERA, 0, 12.9, 11, {
      grosor: 0.08,
    })
    en(g, new THREE.BoxGeometry(4.5, 7, 1.2), '#2E2016', 0, 3.5, 11.2, { grosor: 0.06 }) // door
    for (const x of [-12.5, 12.5]) {
      en(g, new THREE.BoxGeometry(6, 22, 6), BLANCO, x, 11, 9, { grosor: 0.1 })
      en(g, new THREE.BoxGeometry(4.6, 5, 4.6), CANTERA, x, 24.5, 9, { grosor: 0.08 })
      en(g, new THREE.BoxGeometry(1.6, 2.8, 4.8), '#2E2016', x, 24.5, 9, { grosor: 0.04 }) // belfry openings
      en(g, new THREE.SphereGeometry(2.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), BLANCO, x, 27, 9, { grosor: 0.08 })
      en(g, new THREE.CylinderGeometry(0.15, 0.15, 3, 5), COLORES.tinta, x, 30.5, 9, { grosor: 0.03 })
    }
    en(g, new THREE.CylinderGeometry(5.5, 5.5, 4, 12), BLANCO, 0, 13, -6, { grosor: 0.1 })
    en(g, new THREE.SphereGeometry(5.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#F4C26B', 0, 15, -6, { grosor: 0.1 })
    en(g, new THREE.CylinderGeometry(0.15, 0.15, 3.5, 5), COLORES.tinta, 0, 22, -6, { grosor: 0.03 })
    g.scale.setScalar(escala)
    return g
  },

  /** The kiosk of Plaza Zaragoza: octagonal platform, slim columns and a pointed roof */
  kiosco(escala) {
    const g = new THREE.Group()
    en(g, new THREE.CylinderGeometry(7, 7.5, 1.4, 8), CANTERA, 0, 0.7, 0, { grosor: 0.08 })
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      en(g, new THREE.CylinderGeometry(0.22, 0.22, 5, 6), BLANCO, Math.cos(a) * 6, 3.9, Math.sin(a) * 6, { grosor: 0.04 })
    }
    en(g, new THREE.CylinderGeometry(7.6, 7.6, 0.6, 8), BLANCO, 0, 6.7, 0, { grosor: 0.06 })
    en(g, new THREE.ConeGeometry(7.8, 4, 8), '#5E8F6E', 0, 9, 0, { grosor: 0.08 })
    en(g, new THREE.SphereGeometry(0.6, 8, 6), '#F4C26B', 0, 11.3, 0, { grosor: 0.04 })
    g.scale.setScalar(escala)
    return g
  },

  palmera(escala, random) {
    const g = new THREE.Group()
    const alto = 9 + random() * 4
    const tronco = en(g, new THREE.CylinderGeometry(0.3, 0.45, alto, 6), '#8A6A45', 0, alto / 2, 0, { grosor: 0.05 })
    tronco.rotation.z = (random() - 0.5) * 0.12
    for (let i = 0; i < 7; i++) {
      const hoja = en(g, new THREE.ConeGeometry(0.7, 5, 4).translate(0, 2.5, 0).scale(1, 1, 0.3), '#4F7F5F', 0, alto, 0, { grosor: 0.04 })
      hoja.rotation.set(1.9, (i / 7) * Math.PI * 2 + random() * 0.3, 0, 'YXZ')
    }
    g.scale.setScalar(escala)
    return g
  },

  farol(escala) {
    const g = new THREE.Group()
    en(g, new THREE.CylinderGeometry(0.1, 0.14, 4.5, 6), COLORES.tinta, 0, 2.25, 0, { grosor: 0.03 })
    en(g, new THREE.BoxGeometry(0.6, 0.8, 0.6), '#F6E7B0', 0, 4.8, 0, { grosor: 0.05 })
    en(g, new THREE.ConeGeometry(0.55, 0.4, 4).rotateY(Math.PI / 4), COLORES.tinta, 0, 5.4, 0, { grosor: 0.03 })
    g.scale.setScalar(escala)
    return g
  },

  /** A parked city bus ("camión urbano"): long along +x, cream with an orange stripe */
  camion(escala) {
    const g = new THREE.Group()
    en(g, new THREE.BoxGeometry(11, 2.6, 2.6), '#F1E6CC', 0, 1.9, 0, { grosor: 0.1 })
    en(g, new THREE.BoxGeometry(11.04, 0.45, 2.64), '#E4572E', 0, 1.2, 0, { grosor: 0.03, sombra: false })
    en(g, new THREE.BoxGeometry(9, 0.9, 2.66), '#2E2016', -0.6, 2.5, 0, { grosor: 0.03, sombra: false }) // windows
    en(g, new THREE.BoxGeometry(0.1, 1.2, 2.2), '#2E2016', 5.52, 2.4, 0, { grosor: 0.03, sombra: false }) // windshield
    en(g, new THREE.BoxGeometry(2.4, 0.35, 0.5), '#F6C445', 5.5, 3.35, 0, { grosor: 0.03, sombra: false }) // route sign
    const rueda = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10).rotateX(Math.PI / 2)
    for (const x of [-3.6, 3.4]) for (const z of [-1.2, 1.2]) en(g, rueda, COLORES.tinta, x, 0.55, z, { grosor: 0.04 })
    g.scale.setScalar(escala)
    return g
  },

  /** Hot dog stand ("puesto de dogos"): a cart with an umbrella */
  'puesto-dogos'(escala) {
    const g = new THREE.Group()
    en(g, new THREE.BoxGeometry(2.4, 1, 1.2), '#C8CDD2', 0, 1, 0, { grosor: 0.05 })
    en(g, new THREE.BoxGeometry(2.42, 0.25, 1.22), '#E4572E', 0, 1.25, 0, { grosor: 0.03 })
    const rueda = new THREE.CylinderGeometry(0.3, 0.3, 0.15, 8).rotateX(Math.PI / 2)
    for (const z of [-0.65, 0.65]) en(g, rueda, COLORES.tinta, -0.7, 0.3, z, { grosor: 0.03 })
    en(g, new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), COLORES.tinta, 0.6, 2.2, 0, { grosor: 0.02 })
    en(g, new THREE.ConeGeometry(1.8, 0.8, 8), '#F6C445', 0.6, 3.5, 0, { grosor: 0.05 })
    en(g, new THREE.BoxGeometry(0.9, 0.12, 0.4), '#9E2A14', -0.5, 1.55, 0, { grosor: 0.02 }) // the hot dogs
    g.scale.setScalar(escala)
    return g
  },

  /** Radio antenna on the summit: a tall red and white striped mast */
  antena(escala) {
    const g = new THREE.Group()
    const tramos = 7
    for (let i = 0; i < tramos; i++) {
      const r = 0.9 - i * 0.09
      en(g, new THREE.CylinderGeometry(r - 0.09, r, 4, 4), i % 2 ? BLANCO : '#E4572E', 0, 2 + i * 4, 0, { grosor: 0.05 })
    }
    en(g, new THREE.SphereGeometry(0.45, 8, 6), '#E4572E', 0, tramos * 4 + 0.4, 0, { grosor: 0.04 })
    en(g, new THREE.BoxGeometry(3, 2.4, 2.4), CANTERA, 2.5, 1.2, 0, { grosor: 0.06 }) // equipment shed
    g.scale.setScalar(escala)
    return g
  },

  /** The lookout ("mirador"): a small terrace with railing and a shade roof */
  mirador(escala) {
    const g = new THREE.Group()
    en(g, new THREE.BoxGeometry(12, 1, 8), CANTERA, 0, 0.5, 0, { grosor: 0.08 })
    for (const [x, z] of [[-5.5, -3.5], [5.5, -3.5], [-5.5, 3.5], [5.5, 3.5]]) {
      en(g, new THREE.CylinderGeometry(0.2, 0.2, 3.4, 6), BLANCO, x, 2.7, z, { grosor: 0.03 })
    }
    en(g, new THREE.BoxGeometry(12.6, 0.4, 8.6), '#9E2A14', 0, 4.5, 0, { grosor: 0.06 })
    en(g, new THREE.BoxGeometry(12, 0.15, 0.15), COLORES.tinta, 0, 1.9, 4, { grosor: 0.02 }) // railing
    g.scale.setScalar(escala)
    return g
  },

  /** Yellow diamond warning sign with a curve arrow, before every cliff */
  senal(escala) {
    const g = new THREE.Group()
    en(g, new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5), COLORES.tinta, 0, 1.3, 0, { grosor: 0.02 })
    const placa = en(g, new THREE.BoxGeometry(1.5, 1.5, 0.1), '#F6C445', 0, 3, 0, { grosor: 0.05 })
    placa.rotation.z = Math.PI / 4
    const flecha = en(g, new THREE.BoxGeometry(0.75, 0.16, 0.12), COLORES.tinta, 0, 3, 0.04, { grosor: 0.01, sombra: false })
    flecha.rotation.z = 0.5
    en(g, new THREE.ConeGeometry(0.22, 0.4, 3).rotateZ(-Math.PI / 2 + 0.5), COLORES.tinta, 0.36, 3.2, 0.04, { grosor: 0.01, sombra: false })
    g.scale.setScalar(escala)
    return g
  },

  /* ------------------------------ San Carlos ------------------------------ */

  /** Palapa: a thatched palm-leaf umbrella on a wooden pole */
  palapa(escala) {
    const g = new THREE.Group()
    en(g, new THREE.CylinderGeometry(0.15, 0.18, 3, 6), '#8A6A45', 0, 1.5, 0, { grosor: 0.03 })
    en(g, new THREE.ConeGeometry(2.6, 1.5, 10), '#D9B36B', 0, 3.4, 0, { grosor: 0.08 })
    en(g, new THREE.CylinderGeometry(2.62, 2.5, 0.25, 10), '#B8914F', 0, 2.68, 0, { grosor: 0.04 }) // fringe
    g.scale.setScalar(escala)
    return g
  },

  /** Beach umbrella in a bright color */
  sombrilla(escala, random) {
    const g = new THREE.Group()
    const colores = ['#E4572E', '#4F8FE8', '#F6C445', '#7FB7A4', '#F07FB0']
    en(g, new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), BLANCO, 0, 1.2, 0, { grosor: 0.02 })
    en(g, new THREE.ConeGeometry(1.6, 0.6, 8), colores[Math.floor(random() * colores.length)], 0, 2.5, 0, { grosor: 0.05 })
    en(g, new THREE.ConeGeometry(0.5, 0.25, 8), BLANCO, 0, 2.86, 0, { grosor: 0.03 })
    g.scale.setScalar(escala)
    return g
  },

  /** Sailboat: white hull with a blue stripe, a mast and its sail (long along +x) */
  velero(escala) {
    const g = new THREE.Group()
    en(g, new THREE.BoxGeometry(6, 1, 2).translate(0, 0.3, 0), BLANCO, 0, 0, 0, { grosor: 0.06 })
    en(g, new THREE.ConeGeometry(1, 1.6, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.62, 1), BLANCO, 3.7, 0.3, 0, {
      grosor: 0.05,
    }) // bow
    en(g, new THREE.BoxGeometry(6.02, 0.2, 2.02), '#4F8FE8', 0, 0.55, 0, { grosor: 0.02, sombra: false })
    en(g, new THREE.CylinderGeometry(0.08, 0.1, 8, 6), '#8A6A45', 0.4, 4.8, 0, { grosor: 0.02 })
    const vela = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 7), new THREE.Vector2(-3, 0)])
    const lona = en(g, new THREE.ShapeGeometry(vela), '#F7F2E6', 0.3, 1.2, 0, { grosor: 0.04 })
    lona.material.side = THREE.DoubleSide
    g.scale.setScalar(escala)
    return g
  },

  /** Panga: a small fishing launch with an outboard motor */
  lancha(escala, random) {
    const g = new THREE.Group()
    const colores = ['#E4572E', '#7FB7A4', '#F6C445', '#4F8FE8']
    en(g, new THREE.BoxGeometry(5, 0.7, 1.7).translate(0, 0.2, 0), colores[Math.floor(random() * colores.length)], 0, 0, 0, { grosor: 0.05 })
    en(g, new THREE.BoxGeometry(4.6, 0.12, 1.4), BLANCO, 0, 0.58, 0, { grosor: 0.02, sombra: false })
    en(g, new THREE.BoxGeometry(0.5, 0.8, 0.4), COLORES.tinta, -2.6, 0.6, 0, { grosor: 0.03 }) // outboard
    g.scale.setScalar(escala)
    return g
  },

  /** Fallback for a tipo nobody has modeled yet: a magenta box, so it shows up while building */
  desconocido(escala) {
    const g = new THREE.Group()
    en(g, new THREE.BoxGeometry(3 * escala, 3 * escala, 3 * escala), '#ff00ff', 0, 1.5 * escala, 0)
    return g
  },
}
