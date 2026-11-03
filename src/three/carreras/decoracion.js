import * as THREE from 'three'
import { crearSaguaro } from '../piezas.js'
import { COLORES } from './colores.js'
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
/** Skin tones and swimsuits of the people in the water (the same tones as the carne asada's people) */
const PIELES = ['#C68B59', '#A8714A', '#8D5A3B', '#E0AC7E']
const TRAJES = ['#E4572E', '#4F8FE8', '#F6C445', '#9C6ADE', '#F07FB0']

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

  /** A duck on the water (faces +x): brown body, green head, orange beak. `escala` < 0.8: a yellow duckling */
  pato(escala) {
    const g = new THREE.Group()
    const patito = escala < 0.8
    en(g, new THREE.SphereGeometry(0.42, 10, 8).scale(1.3, 0.75, 0.95), patito ? '#E8C85A' : '#8A6A45', 0, 0.18, 0, { grosor: 0.04 })
    en(g, new THREE.SphereGeometry(0.25, 10, 8), patito ? '#E8C85A' : '#3F7A4F', 0.42, 0.62, 0, { grosor: 0.03 })
    en(g, new THREE.ConeGeometry(0.1, 0.26, 6).rotateZ(-Math.PI / 2), '#E4772E', 0.72, 0.58, 0, { grosor: 0.02, sombra: false })
    en(g, new THREE.ConeGeometry(0.14, 0.3, 4).rotateZ(Math.PI / 2.6), patito ? '#E8C85A' : '#6E5236', -0.55, 0.32, 0, { grosor: 0.02 }) // tail
    g.scale.setScalar(escala)
    return g
  },

  /** A kayak with its paddler (long along +x) */
  kayak(escala, random) {
    const g = new THREE.Group()
    const colores = ['#F6C445', '#E4572E', '#7FB7A4', '#4F8FE8']
    const piel = PIELES[Math.floor(random() * PIELES.length)]
    en(g, new THREE.SphereGeometry(1, 12, 8).scale(2.1, 0.32, 0.42), colores[Math.floor(random() * colores.length)], 0, 0.1, 0, { grosor: 0.04 })
    en(g, new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10), COLORES.tinta, 0, 0.36, 0, { grosor: 0.02, sombra: false }) // cockpit
    en(g, new THREE.BoxGeometry(0.3, 0.55, 0.42), '#E4572E', 0, 0.66, 0, { grosor: 0.03 }) // life vest
    en(g, new THREE.SphereGeometry(0.17, 8, 6), piel, 0.02, 1.08, 0, { grosor: 0.025 })
    // The paddle, across, tilted mid-stroke, a blade at each end
    const remo = new THREE.Group()
    en(remo, new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5).rotateX(Math.PI / 2), '#8A6A45', 0, 0, 0, { grosor: 0.01 })
    for (const z of [-1.1, 1.1]) en(remo, new THREE.BoxGeometry(0.22, 0.04, 0.4), BLANCO, 0, 0, z, { grosor: 0.015 })
    remo.position.set(0.2, 0.8, 0)
    remo.rotation.x = 0.45
    g.add(remo)
    g.scale.setScalar(escala)
    return g
  },

  /** Wooden rowboat with two benches and its oars resting on the sides (long along +x) */
  bote(escala) {
    const g = new THREE.Group()
    const madera = '#A9744A'
    en(g, new THREE.BoxGeometry(3.4, 0.6, 1.4).translate(0, 0.25, 0), madera, 0, 0, 0, { grosor: 0.05 })
    en(g, new THREE.ConeGeometry(0.7, 1, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.6, 1), madera, 2.15, 0.25, 0, { grosor: 0.04 }) // bow
    en(g, new THREE.BoxGeometry(3.2, 0.1, 1.2), '#7A5132', 0, 0.5, 0, { grosor: 0.02, sombra: false })
    for (const x of [-0.7, 0.6]) en(g, new THREE.BoxGeometry(0.3, 0.08, 1.3), '#C99A6A', x, 0.56, 0, { grosor: 0.015 })
    for (const z of [-1, 1]) {
      const remo = en(g, new THREE.BoxGeometry(2.4, 0.06, 0.14), '#8A6A45', -0.1, 0.62, z * 0.95, { grosor: 0.015 })
      remo.rotation.y = z * 0.25
    }
    g.scale.setScalar(escala)
    return g
  },

  /** Someone swimming: head with a bright swim cap, shoulders at the surface, an arm up mid-stroke (faces +x) */
  nadador(escala, random) {
    const g = new THREE.Group()
    const piel = PIELES[Math.floor(random() * PIELES.length)]
    const gorra = ['#E4572E', '#4F8FE8', '#F6C445', '#F07FB0', '#7FB7A4'][Math.floor(random() * 5)]
    en(g, new THREE.SphereGeometry(0.42, 10, 6).scale(1.25, 0.32, 1.05), piel, -0.2, 0.04, 0, { grosor: 0.03 }) // shoulders
    en(g, new THREE.SphereGeometry(0.27, 12, 10), piel, 0.28, 0.3, 0, { grosor: 0.03 })
    en(g, new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), gorra, 0.26, 0.34, 0, { grosor: 0.025 })
    // One arm up out of the water, mid-stroke; the other hand just ahead at the surface
    const brazo = en(g, new THREE.BoxGeometry(0.15, 0.85, 0.15).translate(0, 0.42, 0), piel, -0.15, 0.08, 0.42, { grosor: 0.02 })
    brazo.rotation.z = -0.35
    en(g, new THREE.BoxGeometry(0.18, 0.1, 0.18), piel, 0.75, 0.04, -0.3, { grosor: 0.015, sombra: false })
    // Splash around them
    en(g, new THREE.TorusGeometry(0.75, 0.07, 4, 18).rotateX(Math.PI / 2), '#F4FBFC', 0, 0.02, 0, { grosor: 0.01, sombra: false })
    g.scale.setScalar(escala * 1.2)
    return g
  },

  /** An inflatable ring (a "dona") with someone sitting in it */
  flotador(escala, random) {
    const g = new THREE.Group()
    const colores = ['#F07FB0', '#F6C445', '#7FB7A4', '#E4572E']
    const piel = PIELES[Math.floor(random() * PIELES.length)]
    en(g, new THREE.TorusGeometry(0.7, 0.28, 8, 18).rotateX(Math.PI / 2), colores[Math.floor(random() * colores.length)], 0, 0.15, 0, { grosor: 0.04 })
    en(g, new THREE.TorusGeometry(0.7, 0.29, 8, 18, Math.PI / 3).rotateX(Math.PI / 2), BLANCO, 0, 0.15, 0, { grosor: 0.01, sombra: false }) // stripe
    en(g, new THREE.BoxGeometry(0.34, 0.5, 0.44), TRAJES[Math.floor(random() * TRAJES.length)], 0, 0.45, 0, { grosor: 0.03 })
    en(g, new THREE.SphereGeometry(0.17, 8, 6), piel, 0, 0.85, 0, { grosor: 0.025 })
    // Arms resting on the ring
    for (const z of [-0.36, 0.36]) en(g, new THREE.BoxGeometry(0.12, 0.12, 0.42), piel, 0.05, 0.42, z * 1.3, { grosor: 0.015 })
    g.scale.setScalar(escala)
    return g
  },

  /** Reeds at the water's edge: a clump of tall green blades, some with a brown cattail on top */
  juncos(escala, random) {
    const g = new THREE.Group()
    for (let i = 0; i < 7; i++) {
      const alto = 1.2 + random() * 1
      const a = random() * Math.PI * 2
      const r = random() * 0.45
      const hoja = en(g, new THREE.CylinderGeometry(0.03, 0.06, alto, 4).translate(0, alto / 2, 0), '#5E8F4E', Math.cos(a) * r, 0, Math.sin(a) * r, { grosor: 0.015 })
      hoja.rotation.set((random() - 0.5) * 0.3, 0, (random() - 0.5) * 0.3)
      if (random() < 0.5) en(hoja, new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), '#7A5132', 0, alto, 0, { grosor: 0.015 })
    }
    g.scale.setScalar(escala)
    return g
  },

  /** A camel resting on its knees (faces +x): body, hump, long neck and head */
  camello(escala) {
    const g = new THREE.Group()
    const pelo = '#C9975A'
    en(g, new THREE.SphereGeometry(1, 12, 8).scale(1.4, 0.7, 0.75), pelo, 0, 0.75, 0, { grosor: 0.05 })
    en(g, new THREE.SphereGeometry(0.6, 10, 8).scale(1, 0.9, 0.9), pelo, -0.1, 1.45, 0, { grosor: 0.04 }) // hump
    const cuello = en(g, new THREE.CylinderGeometry(0.2, 0.28, 1.3, 8).translate(0, 0.65, 0), pelo, 1.15, 0.9, 0, { grosor: 0.04 })
    cuello.rotation.z = -0.55
    en(g, new THREE.BoxGeometry(0.7, 0.35, 0.35), pelo, 1.95, 2.0, 0, { grosor: 0.03 }) // head
    for (const z of [-0.12, 0.12]) en(g, new THREE.BoxGeometry(0.1, 0.18, 0.08), '#A87B47', 1.75, 2.22, z, { grosor: 0.015 }) // ears
    // A saddle blanket in bright colors
    en(g, new THREE.BoxGeometry(0.9, 0.06, 1.55), '#E4572E', -0.1, 1.33, 0, { grosor: 0.02, sombra: false })
    en(g, new THREE.BoxGeometry(0.92, 0.07, 0.3), '#F6C445', -0.1, 1.34, 0, { grosor: 0.01, sombra: false })
    g.scale.setScalar(escala)
    return g
  },

  /** A desert tent: striped cloth on posts, open at the front (+z), with a rug outside */
  carpa(escala) {
    const g = new THREE.Group()
    for (const [x, z] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]]) en(g, new THREE.CylinderGeometry(0.08, 0.08, 2.4, 5), '#8A6A45', x, 1.2, z, { grosor: 0.02 })
    // Roof: two slopes meeting at a ridge, in stripes
    for (const lado of [-1, 1]) {
      const techo = en(g, new THREE.BoxGeometry(4.6, 0.08, 2), '#F1E6CC', 0, 2.75, lado * 0.85, { grosor: 0.03 })
      techo.rotation.x = lado * 0.42
      for (const x of [-1.6, 0, 1.6]) {
        const franja = en(g, new THREE.BoxGeometry(0.6, 0.09, 2.02), '#B5442A', x, 2.75, lado * 0.85, { grosor: 0.01, sombra: false })
        franja.rotation.x = lado * 0.42
      }
    }
    // The back wall and the rug in front of the opening
    en(g, new THREE.BoxGeometry(4.2, 2.2, 0.06), '#E9D7B4', 0, 1.1, -1.55, { grosor: 0.02 })
    en(g, new THREE.BoxGeometry(2.6, 0.04, 1.6), '#9C3B2A', 0, 0.02, 2.4, { grosor: 0.01, sombra: false })
    en(g, new THREE.BoxGeometry(2.2, 0.05, 1.2), '#E2A84B', 0, 0.03, 2.4, { grosor: 0.01, sombra: false })
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
