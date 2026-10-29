import * as THREE from 'three'
import { COLORES } from '../render/colores.js'
import { brush, lienzo } from '../pincel.js'
import { conContorno, pieza, toon } from './materiales.js'
import { rng } from '../../three/piezas.js'

/**
 * What the items leave on the road (burros, potholes, puddles, smoke, speed bumps, coyotas…)
 * and the item boxes. One model per item id, with a fallback per mecánica, so a new item from
 * items.json shows up even before it has its own model.
 */

function en(grupo, geo, color, x, y, z, opciones) {
  const p = pieza(geo, color, opciones)
  p.position.set(x, y, z)
  grupo.add(p)
  return p
}

/** Flat decal lying on the ground (not lit, no outline) */
function calcomania(radio, color, opacidad = 1, lados = 14, irregular = 0) {
  const geo = new THREE.CircleGeometry(radio, lados)
  if (irregular) {
    const pos = geo.attributes.position
    for (let i = 1; i < pos.count; i++) {
      const k = 1 + (Math.sin(i * 2.7) * 0.5 + Math.cos(i * 1.3) * 0.5) * irregular
      pos.setXY(i, pos.getX(i) * k, pos.getY(i) * k)
    }
  }
  geo.rotateX(-Math.PI / 2)
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color, transparent: opacidad < 1, opacity: opacidad, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
  )
}

/**
 * Each model: (item, id) → { grupo, animar?(t, vida, etapa), sobreSuelo? }. `sobreSuelo` (its size in m)
 * marks things lying on the road (pothole, puddle, speed bump): they're tilted with the slope
 * and lifted so no part sinks into a hill.
 */
const MODELOS = {
  /** Burro percherón: a stout donkey that gallops (it runs along +x) */
  burro() {
    const g = new THREE.Group()
    const cafe = '#8A6A45'
    en(g, new THREE.BoxGeometry(2.2, 1.1, 1), cafe, 0, 1.6, 0, { grosor: 0.06 })
    en(g, new THREE.BoxGeometry(0.6, 0.9, 0.55), cafe, 1.15, 2.1, 0, { grosor: 0.05 }) // neck
    en(g, new THREE.BoxGeometry(0.95, 0.55, 0.55), '#9C7A55', 1.55, 2.5, 0, { grosor: 0.05 }) // head
    en(g, new THREE.BoxGeometry(0.3, 0.3, 0.5), '#D9C7A8', 2.02, 2.38, 0, { grosor: 0.03 }) // muzzle
    for (const z of [-0.18, 0.18]) {
      const oreja = en(g, new THREE.ConeGeometry(0.12, 0.7, 4), cafe, 1.35, 3.05, z, { grosor: 0.03 })
      oreja.rotation.z = 0.25
    }
    en(g, new THREE.BoxGeometry(0.6, 0.15, 0.2), COLORES.tinta, -0.2, 2.2, 0, { grosor: 0.02 }) // mane
    const cola = en(g, new THREE.BoxGeometry(0.12, 0.9, 0.12), COLORES.tinta, -1.15, 1.6, 0, { grosor: 0.02 })
    cola.rotation.z = 0.5
    const patas = []
    for (const [x, z] of [[0.8, -0.35], [0.8, 0.35], [-0.8, -0.35], [-0.8, 0.35]]) {
      const pata = new THREE.Group()
      pata.position.set(x, 1.2, z)
      en(pata, new THREE.BoxGeometry(0.25, 1.2, 0.25).translate(0, -0.6, 0), cafe, 0, 0, 0, { grosor: 0.03 })
      g.add(pata)
      patas.push(pata)
    }
    // A bit bigger than life, so it reads from the high match camera
    g.scale.setScalar(1.5)
    return {
      grupo: g,
      animar(t) {
        patas.forEach((p, i) => (p.rotation.z = Math.sin(t * 18 + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0)) * 0.7))
        g.children[0].position.y = 1.6 + Math.abs(Math.sin(t * 18)) * 0.15
      },
    }
  },

  /**
   * Bache: a dark broken patch with cracks. As laps go by (`etapa`, from the server) the city
   * shows up: first detour signs (1), then wooden planks covering it (2, it's road again).
   * Cars arrive from -x (it was dropped behind someone driving toward +x).
   */
  bache(item) {
    const g = new THREE.Group()
    const r = item.radio ?? 2
    // The hole itself: rim, hole and cracks (all decals, hidden together once it's covered)
    const bache = new THREE.Group()
    bache.add(calcomania(r + 0.4, '#5C4834', 1, 10, 0.25))
    const hoyo = calcomania(r, COLORES.tinta, 1, 10, 0.3)
    hoyo.position.y = 0.01
    bache.add(hoyo)
    for (let i = 0; i < 4; i++) {
      const grieta = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.12).rotateX(-Math.PI / 2), hoyo.material)
      grieta.rotation.y = i * 1.4
      grieta.position.set(Math.cos(i * 1.4) * 2.2, 0.01, -Math.sin(i * 1.4) * 2.2)
      bache.add(grieta)
    }
    g.add(bache)

    // 1: detour signs. Cones around the hole and an arrow board before it, facing the traffic
    const senales = new THREE.Group()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const cono = new THREE.Group()
      en(cono, new THREE.ConeGeometry(0.28, 0.8, 8), '#F28C28', 0, 0.45, 0, { grosor: 0.03 })
      en(cono, new THREE.CylinderGeometry(0.2, 0.22, 0.12, 8), '#F1E6CC', 0, 0.5, 0, { grosor: 0.01, sombra: false })
      en(cono, new THREE.BoxGeometry(0.6, 0.06, 0.6), COLORES.tinta, 0, 0.03, 0, { grosor: 0.01, sombra: false })
      cono.position.set(Math.cos(a) * (r + 0.9), 0, Math.sin(a) * (r + 0.9))
      senales.add(cono)
    }
    const letrero = new THREE.Group()
    for (const z of [-0.8, 0.8]) en(letrero, new THREE.BoxGeometry(0.1, 1.4, 0.1), '#8A6A45', 0, 0.7, z, { grosor: 0.02 })
    const tablero = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.9, 2),
      // Thin along x and wide along z: its -x face (the 2nd material) looks at the incoming cars
      [toon(COLORES.tinta), new THREE.MeshBasicMaterial({ map: texturaDesvio() }), toon(COLORES.tinta), toon(COLORES.tinta), toon(COLORES.tinta), toon(COLORES.tinta)],
    )
    tablero.position.y = 1.6
    tablero.castShadow = true
    letrero.add(conContorno(tablero, 0.03))
    letrero.position.set(-(r + 3.5), 0, 0)
    senales.add(letrero)
    senales.visible = false
    g.add(senales)

    // 2: covered with planks laid across, a little uneven. Lifted a bit and without a cast
    // shadow: right on the ground they cut into curved edges and slopes and read as a stray shadow
    const tablas = new THREE.Group()
    const n = 6
    for (let i = 0; i < n; i++) {
      const z = -r + ((2 * r) / n) * (i + 0.5)
      const tabla = en(tablas, new THREE.BoxGeometry(2 * r + 1.2, 0.12, (2 * r) / n - 0.08), i % 2 ? '#B48A57' : '#A07848', Math.sin(i * 2.3) * 0.2, 0.18, z, {
        grosor: 0.02,
        sombra: false,
      })
      tabla.rotation.y = Math.sin(i * 1.7) * 0.06
    }
    tablas.visible = false
    g.add(tablas)

    return {
      grupo: g,
      // The slope is measured as far as the planks reach (half their length plus a margin)
      sobreSuelo: r + 1.4,
      animar(t, vida, etapa) {
        senales.visible = etapa === 1
        tablas.visible = etapa === 2
        // Covered: only the planks. The decals are drawn "over" the ground (polygon offset), and
        // from far away they'd show through the planks
        bache.visible = etapa < 2
      },
    }
  },

  /**
   * Cráter del meteorito: a scorched hole with a broken rim, bits of rock thrown around and the
   * meteor itself still stuck in the middle, half buried and glowing a little
   */
  crater(item) {
    const g = new THREE.Group()
    const r = item.radio ?? 2.5
    g.add(calcomania(r + 1.2, '#7A5634', 1, 12, 0.3))
    const hoyo = calcomania(r, COLORES.tinta, 1, 12, 0.25)
    hoyo.position.y = 0.01
    g.add(hoyo)
    // Broken rim: dirt chunks around the edge
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.sin(i * 3.1) * 0.2
      const d = r + 0.3 + Math.cos(i * 1.7) * 0.25
      const terron = en(g, new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.12, 0), '#9A7A55', Math.cos(a) * d, 0.1, Math.sin(a) * d, {
        grosor: 0.03,
      })
      terron.rotation.set(i, i * 2, 0)
    }
    // The meteor, half buried and tilted the way it came in
    const roca = en(g, new THREE.DodecahedronGeometry(1.4, 0), '#5C4834', 0.2, 0.35, 0, { grosor: 0.07 })
    roca.rotation.set(0.5, 0.8, 0.3)
    const brasa = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#E4572E', transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
    )
    brasa.position.y = 0.02
    g.add(brasa)
    return {
      grupo: g,
      sobreSuelo: r + 0.6,
      animar(t) {
        // The rock still glows under it, slowly
        brasa.material.opacity = 0.3 + Math.sin(t * 2) * 0.15
      },
    }
  },

  /** Charco de la tromba: a blue puddle with ripples; drying up (`etapa` 1), it's smaller */
  charco(item) {
    const g = new THREE.Group()
    const charco = new THREE.Group()
    g.add(charco)
    const r = item.radio ?? 5
    charco.add(calcomania(r + 0.25, COLORES.tinta, 0.6, 18, 0.12))
    const agua = calcomania(r, '#6FA3C8', 0.85, 18, 0.12)
    agua.position.y = 0.01
    charco.add(agua)
    const ondas = []
    for (let i = 0; i < 2; i++) {
      const onda = new THREE.Mesh(
        new THREE.RingGeometry(1, 1.15, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#D7ECF7', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
      )
      onda.position.y = 0.02
      charco.add(onda)
      ondas.push(onda)
    }
    return {
      grupo: g,
      sobreSuelo: r + 0.3,
      animar(t, vida, etapa) {
        // Same scale as the server's smaller radius (it changes only while nobody's looking)
        charco.scale.setScalar(etapa === 1 ? (item.encoge ?? 0.5) : 1)
        ondas.forEach((o, i) => {
          const f = (t * 0.6 + i * 0.5) % 1
          o.scale.setScalar(0.5 + f * (r - 1))
          o.material.opacity = 1 - f
        })
      },
    }
  },

  /** Ola de calor: a translucent orange cone ahead of the car */
  calor(item) {
    const g = new THREE.Group()
    const largo = item.alcance ?? 24
    const radio = Math.tan((((item.angulo ?? 50) / 2) * Math.PI) / 180) * largo
    const cono = new THREE.Mesh(
      new THREE.ConeGeometry(radio, largo, 20, 1, true).rotateZ(Math.PI / 2).translate(largo / 2, 1.2, 0),
      new THREE.MeshBasicMaterial({ color: '#F4B33A', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    )
    g.add(cono)
    return {
      grupo: g,
      animar(t, vida) {
        cono.material.opacity = 0.45 * vida
        cono.scale.set(1.1 - vida * 0.3, 1, 1)
      },
    }
  },

  /** Humo de carne asada: a thick cluster of smoke puffs that breathes */
  humo(item) {
    const g = new THREE.Group()
    const r = item.radio ?? 11
    // Soft, rounder and see-through-ish puffs (no ink outline: with it they read as rocks)
    const materiales = ['#DAD4C9', '#BDB4A6', '#EFEBE3'].map(
      (color) => new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.9, gradientMap: toon('#fff').gradientMap }),
    )
    const bolas = []
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 * 3
      const d = ((i % 5) / 4) * r * 0.75
      const bola = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 + (i % 4) * 0.7, 1), materiales[i % 3])
      bola.position.set(Math.cos(a) * d, 1.5 + (i % 6) * 0.9, Math.sin(a) * d)
      g.add(bola)
      bolas.push(bola)
    }
    return {
      grupo: g,
      animar(t, vida) {
        const aparece = Math.min(1, (1 - vida) * 6, vida * 4)
        bolas.forEach((b, i) => {
          b.scale.setScalar(aparece * (1 + Math.sin(t * 2 + i) * 0.1))
          b.rotation.y = t * 0.3 + i
        })
      },
    }
  },

  /** Tope: a yellow and black striped bump lying across the road */
  tope(item) {
    const g = new THREE.Group()
    const largo = (item.radio ?? 6) * 2
    const tramos = 8
    for (let i = 0; i < tramos; i++) {
      const z = -largo / 2 + (largo / tramos) * (i + 0.5)
      en(g, new THREE.BoxGeometry(1, 0.35, largo / tramos), i % 2 ? COLORES.tinta : '#F6C445', 0, 0.18, z, { grosor: 0.03 })
    }
    return { grupo: g, sobreSuelo: largo / 2 }
  },

  /** Coyotas: flat golden discs with dark spots, flying flat */
  coyotas() {
    const g = new THREE.Group()
    en(g, new THREE.CylinderGeometry(0.75, 0.75, 0.14, 12), '#D9A55B', 0, 1.1, 0, { grosor: 0.04 })
    for (const [x, z] of [[0.3, 0.1], [-0.2, 0.3], [-0.1, -0.35], [0.25, -0.3]]) {
      en(g, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 6), '#7A4A1E', x, 1.19, z, { grosor: 0.01, sombra: false })
    }
    return { grupo: g }
  },

  /** Poste de luz: a concrete pole with its crossarm, insulators, wires stub and a street lamp */
  poste(item) {
    const g = new THREE.Group()
    const r = item.radio ?? 0.45
    const gris = '#B8B0A2'
    en(g, new THREE.CylinderGeometry(r * 0.55, r, 9, 8), gris, 0, 4.5, 0, { grosor: 0.05 })
    en(g, new THREE.BoxGeometry(0.22, 0.22, 3.2), '#8A6A45', 0, 8.2, 0, { grosor: 0.04 }) // crossarm
    for (const z of [-1.3, 0, 1.3]) {
      en(g, new THREE.CylinderGeometry(0.08, 0.12, 0.35, 6), '#6FA3C8', 0, 8.5, z, { grosor: 0.02, sombra: false }) // insulators
    }
    // Lamp arm toward the road and its yellow light
    en(g, new THREE.BoxGeometry(2, 0.12, 0.12), gris, 1, 7.2, 0, { grosor: 0.03 })
    en(g, new THREE.BoxGeometry(0.7, 0.2, 0.4), COLORES.tinta, 2, 7.1, 0, { grosor: 0.03 })
    en(g, new THREE.BoxGeometry(0.5, 0.06, 0.3), '#F6E7B0', 2, 6.98, 0, { grosor: 0.01, sombra: false })
    // Base with a couple of cracks: it was planted in a hurry
    g.add(calcomania(r + 0.6, '#7A6C5C', 1, 9, 0.3))
    return { grupo: g }
  },

  /** Asador: a small charcoal grill on legs, with glowing coals and a puff of smoke */
  asador(item) {
    const g = new THREE.Group()
    const r = item.radio ?? 0.8
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const pata = en(g, new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5), COLORES.tinta, Math.cos(a) * r * 0.6, 0.45, Math.sin(a) * r * 0.6, {
        grosor: 0.02,
      })
      pata.rotation.set(Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15)
    }
    en(g, new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#2E2016', 0, 1.05, 0, { grosor: 0.05 }) // bowl
    en(g, new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.05, 12), '#E4572E', 0, 1.02, 0, { grosor: 0.02, sombra: false }) // coals
    en(g, new THREE.BoxGeometry(r * 1.4, 0.04, r * 1.4), '#5C4834', 0, 1.08, 0, { grosor: 0.01, sombra: false }) // grill
    en(g, new THREE.BoxGeometry(0.5, 0.08, 0.25), '#9E2A14', 0.1, 1.14, 0.1, { grosor: 0.02, sombra: false }) // the carne asada
    const humo = en(g, new THREE.IcosahedronGeometry(0.45, 1), '#E8E2D4', 0, 1.8, 0, { grosor: 0.02, sombra: false })
    return {
      grupo: g,
      animar(t) {
        // A thin, lazy plume that keeps rising and starting over
        const f = (t * 0.5) % 1
        humo.position.y = 1.4 + f * 2.2
        humo.scale.setScalar(0.6 + f * 1.2)
        humo.visible = f < 0.9
      },
    }
  },

  /**
   * Meteorito: a red target on the ground (where it'll land) and the rock coming down at an
   * angle with a fiery tail. `vida` goes 1 → 0 while it falls: at 0 it hits the ground.
   */
  meteorito(item) {
    const g = new THREE.Group()
    const r = item.radio ?? 3
    const marca = new THREE.Group()
    const rojo = new THREE.MeshBasicMaterial({ color: '#E4572E', transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
    marca.add(new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r, 32).rotateX(-Math.PI / 2), rojo))
    marca.add(new THREE.Mesh(new THREE.RingGeometry(r * 0.35, r * 0.45, 24).rotateX(-Math.PI / 2), rojo))
    for (let i = 0; i < 4; i++) {
      const raya = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.5, 0.25).rotateX(-Math.PI / 2), rojo)
      const a = (i * Math.PI) / 2
      raya.position.set(Math.cos(a) * r * 0.7, 0, Math.sin(a) * r * 0.7)
      raya.rotation.y = -a
      marca.add(raya)
    }
    marca.position.y = 0.03
    g.add(marca)
    const sombra = calcomania(r * 0.8, COLORES.tinta, 0.35, 16)
    sombra.position.y = 0.02
    g.add(sombra)

    // The rock and its tail, pointing back along the way it came (from +x, up high)
    const roca = new THREE.Group()
    const piedra = en(roca, new THREE.DodecahedronGeometry(1.6, 0), '#5C4834', 0, 0, 0, { grosor: 0.08 })
    const fuego = new THREE.MeshBasicMaterial({ color: '#F4B33A', transparent: true, opacity: 0.85, depthWrite: false })
    const cola = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9, 10, 1, true).translate(0, 4.5, 0), fuego)
    roca.add(cola)
    const brasa = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 0), new THREE.MeshBasicMaterial({ color: '#E4572E', transparent: true, opacity: 0.55, depthWrite: false }))
    roca.add(brasa)
    g.add(roca)
    const direccion = new THREE.Vector3(0.45, 1, 0).normalize()
    cola.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direccion)

    return {
      grupo: g,
      sobreSuelo: r + 0.4,
      animar(t, vida) {
        // The target pulses faster as it gets close and the shadow under it grows
        const pulso = 1 + Math.sin(t * (6 + (1 - vida) * 14)) * 0.08
        marca.scale.setScalar(pulso)
        marca.rotation.y = t * 1.5
        rojo.opacity = 0.55 + (1 - vida) * 0.45
        sombra.scale.setScalar(0.3 + (1 - vida) * 0.9)
        // Falls along `direccion`, faster at the end
        const d = 4 + vida ** 1.4 * 140
        roca.position.copy(direccion).multiplyScalar(d)
        piedra.rotation.set(t * 3, t * 2, 0)
        brasa.scale.setScalar(1 + Math.sin(t * 30) * 0.15)
      },
    }
  },
}

const CAMISAS = ['#E4572E', '#4F8FE8', '#F6C445', '#7FB7A4', '#9C6ADE', '#F07FB0', '#F1E6CC', '#3A6B4F']
const PANTALONES = ['#3B4F7A', '#5C4834', '#2E2A26', '#8A7A5C']
const PIELES = ['#C68B59', '#A8714A', '#8D5A3B', '#E0AC7E']

/**
 * A person at the carne asada (faces +x). Colors and hat come from the entity id, so the same
 * person looks the same in every browser (and when it flies off). `etapa` 0: hanging out, eating;
 * 1: running away with the arms up. `agitar(t)` flails the limbs (flying off, ragdoll style).
 */
export function crearPersona(id) {
  const random = rng(id * 13 + 5)
  const elige = (lista) => lista[Math.floor(random() * lista.length)]
  const camisa = elige(CAMISAS)
  const pantalon = elige(PANTALONES)
  const piel = elige(PIELES)
  const g = new THREE.Group()
  const cuerpo = new THREE.Group()
  g.add(cuerpo)

  const piernas = [-0.13, 0.13].map((z) => {
    const pierna = new THREE.Group()
    pierna.position.set(0, 0.9, z)
    en(pierna, new THREE.BoxGeometry(0.2, 0.9, 0.2).translate(0, -0.45, 0), pantalon, 0, 0, 0, { grosor: 0.025 })
    cuerpo.add(pierna)
    return pierna
  })
  en(cuerpo, new THREE.BoxGeometry(0.34, 0.66, 0.52), camisa, 0, 1.24, 0, { grosor: 0.03 })
  en(cuerpo, new THREE.BoxGeometry(0.32, 0.32, 0.32), piel, 0.01, 1.76, 0, { grosor: 0.03 })
  // Some wear a cowboy hat (it's Sonora)
  if (random() < 0.5) {
    const sombrero = elige(['#D9BF8C', '#8A6A45', '#F1E6CC'])
    en(cuerpo, new THREE.CylinderGeometry(0.36, 0.36, 0.04, 12), sombrero, 0, 1.94, 0, { grosor: 0.015 })
    en(cuerpo, new THREE.CylinderGeometry(0.15, 0.19, 0.2, 10), sombrero, 0, 2.04, 0, { grosor: 0.015 })
  }
  const brazos = [-0.33, 0.33].map((z, i) => {
    const brazo = new THREE.Group()
    brazo.position.set(0, 1.52, z)
    en(brazo, new THREE.BoxGeometry(0.14, 0.62, 0.14).translate(0, -0.31, 0), camisa, 0, 0, 0, { grosor: 0.02 })
    en(brazo, new THREE.BoxGeometry(0.13, 0.13, 0.13), piel, 0, -0.66, 0, { grosor: 0.015, sombra: false })
    // A taco (or a soda) in the right hand
    if (i === 1) en(brazo, new THREE.BoxGeometry(0.22, 0.08, 0.1), random() < 0.5 ? '#E8C27A' : '#B33A2A', 0.08, -0.7, 0, { grosor: 0.01, sombra: false })
    cuerpo.add(brazo)
    return brazo
  })
  // A bit bigger than life, so they read from the high match camera
  g.scale.setScalar(1.25)
  const fase = random() * 10

  return {
    grupo: g,
    animar(t, vida, etapa) {
      if (etapa === 1) {
        // Running away in a panic: fast legs, arms up waving, leaning forward with little hops
        const paso = t * 15 + fase
        piernas[0].rotation.z = Math.sin(paso) * 0.9
        piernas[1].rotation.z = -Math.sin(paso) * 0.9
        brazos[0].rotation.set(Math.sin(paso * 1.3) * 0.3 - 0.4, 0, 2.7 + Math.sin(paso) * 0.3)
        brazos[1].rotation.set(-Math.sin(paso * 1.3) * 0.3 + 0.4, 0, 2.7 - Math.sin(paso) * 0.3)
        cuerpo.rotation.z = -0.22
        cuerpo.position.y = Math.abs(Math.sin(paso)) * 0.14
      } else {
        // Hanging out: swaying a little, taking a bite now and then, laughing
        piernas[0].rotation.z = 0
        piernas[1].rotation.z = 0
        brazos[0].rotation.set(-0.1, 0, 0.15 + Math.sin(t * 0.8 + fase) * 0.1)
        brazos[1].rotation.set(0.1, 0, 0.3 + Math.max(0, Math.sin(t * 1.3 + fase)) * 1.9)
        cuerpo.rotation.z = Math.sin(t * 1.1 + fase) * 0.05
        cuerpo.position.y = Math.max(0, Math.sin(t * 9 + fase)) * 0.03
      }
    },
    agitar(t) {
      piernas.forEach((p, i) => (p.rotation.set(Math.sin(t * 13 + i) * 0.8, 0, Math.cos(t * 11 + i * 2) * 1.2)))
      brazos.forEach((b, i) => (b.rotation.set(Math.sin(t * 17 + i * 3) * 1.5, 0, 1.5 + Math.cos(t * 14 + i) * 1.4)))
      cuerpo.rotation.z = 0
      cuerpo.position.y = 0
    },
  }
}

/* ---------------------------- Street character ---------------------------- */

/** Speech bubble height, as a fraction of the picture's height (match camera, fov 50) */
const ALTO_GLOBO = 0.065
/** Each phrase stays this long (s), then a short silence until the next one */
const FRASE_SEGUNDOS = 2.6
const FRASE_PAUSA = 1.1
const texturasGlobo = new Map()

/** A comic speech bubble with the phrase in brush letters (cached per phrase) */
function texturaGlobo(frase) {
  if (texturasGlobo.has(frase)) return texturasGlobo.get(frase)
  const fuente = '400 44px "Caveat Brush", "Comic Sans MS", cursive'
  const medir = lienzo(8, 8, { offscreen: false }).g
  medir.font = fuente
  const ancho = Math.ceil(Math.min(560, medir.measureText(frase).width) + 48)
  const alto = 92
  const { c, g } = lienzo(ancho, alto, { offscreen: false })
  const cuerpo = alto - 22
  g.fillStyle = '#FFFDF6'
  g.strokeStyle = COLORES.tinta
  g.lineWidth = 5
  g.beginPath()
  g.roundRect(4, 4, ancho - 8, cuerpo - 4, 24)
  g.fill()
  g.stroke()
  // The tail, pointing down to the speaker
  g.beginPath()
  g.moveTo(ancho / 2 - 14, cuerpo - 3)
  g.lineTo(ancho / 2, alto - 3)
  g.lineTo(ancho / 2 + 10, cuerpo - 3)
  g.closePath()
  g.fill()
  g.beginPath()
  g.moveTo(ancho / 2 - 14, cuerpo - 1)
  g.lineTo(ancho / 2, alto - 3)
  g.lineTo(ancho / 2 + 10, cuerpo - 1)
  g.stroke()
  g.font = fuente
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = COLORES.tinta
  g.fillText(frase, ancho / 2, cuerpo / 2 + 3, ancho - 30)
  const textura = new THREE.CanvasTexture(c)
  textura.colorSpace = THREE.SRGBColorSpace
  const valor = { textura, aspecto: ancho / alto }
  texturasGlobo.set(frase, valor)
  return valor
}

/**
 * Personaje de la calle: a person standing in the middle of the road with a box of mazapanes,
 * yelling things (`item.frases`, one after another in a speech bubble). `etapa` 1: a car is
 * coming fast and it runs across the road (the server moves it).
 */
function crearCalle(item, id) {
  const persona = crearPersona(id)
  const g = persona.grupo
  // Alone in the middle of the road: a bit bigger than the people at the carne asada, to read from afar
  g.scale.setScalar(1.5)
  const random = rng(id * 7 + 3)
  // The box of goods in the left hand
  const caja = en(g, new THREE.BoxGeometry(0.4, 0.22, 0.32), '#C9A46B', 0.25, 1.0, -0.42, { grosor: 0.02 })
  en(g, new THREE.BoxGeometry(0.34, 0.04, 0.26), '#E4572E', 0.25, 1.12, -0.42, { grosor: 0.01, sombra: false })

  const frases = item.frases?.length ? item.frases : ['¡Pásele!']
  const primera = Math.floor(random() * frases.length)
  const desfase = random() * 3
  const globo = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }))
  globo.center.set(0.5, 0)
  globo.position.y = 2.25
  globo.renderOrder = 11
  g.add(globo)
  let frase = null
  const alto = (2 * ALTO_GLOBO * Math.tan((25 * Math.PI) / 180)) / g.scale.y

  return {
    grupo: g,
    animar(t, vida, etapa) {
      // 1: running across the road with the arms up (and the box dropped); 0: standing, yelling
      persona.animar(t, vida, etapa)
      caja.visible = etapa !== 1
      // Phrases one after another, each one a while, with a short pause between them
      const ciclo = (t + desfase) / (FRASE_SEGUNDOS + FRASE_PAUSA)
      const visible = (ciclo % 1) * (FRASE_SEGUNDOS + FRASE_PAUSA) < FRASE_SEGUNDOS
      globo.visible = visible
      if (!visible) return
      const actual = frases[(primera + Math.floor(ciclo)) % frases.length]
      if (actual !== frase) {
        frase = actual
        const { textura, aspecto } = texturaGlobo(frase)
        globo.material.map = textura
        globo.material.needsUpdate = true
        globo.scale.set(alto * aspecto, alto, 1)
      }
    },
  }
}

/** Fallbacks by mecánica, for items without their own model */
const POR_MECANICA = {
  misil: 'burro',
  mina: 'bache',
  mancha: 'charco',
  cono: 'calor',
  nube: 'humo',
  obstaculo: 'tope',
  abanico: 'coyotas',
  estorbo: 'poste',
}

/** `id`: the entity's, for things that look different one from another (the people) */
export function crearModeloEntidad(item, id = 0) {
  if (item.mecanica === 'persona') return crearPersona(id)
  if (item.mecanica === 'calle') return crearCalle(item, id)
  const crear = MODELOS[item.id] ?? MODELOS[POR_MECANICA[item.mecanica]]
  if (crear) return crear(item)
  const g = new THREE.Group()
  en(g, new THREE.SphereGeometry(1, 8, 6), '#ff00ff', 0, 1, 0)
  return { grupo: g }
}

let texturaFlecha = null

/** The detour board: white arrow on orange with ink stripes, painted with the brush */
function texturaDesvio() {
  if (texturaFlecha) return texturaFlecha
  const { c, g } = lienzo(256, 128, { offscreen: false })
  g.fillStyle = '#F28C28'
  g.fillRect(0, 0, 256, 128)
  g.fillStyle = COLORES.crema
  g.beginPath()
  g.moveTo(40, 52)
  g.lineTo(160, 52)
  g.lineTo(160, 28)
  g.lineTo(220, 64)
  g.lineTo(160, 100)
  g.lineTo(160, 76)
  g.lineTo(40, 76)
  g.closePath()
  g.fill()
  brush(g, [[8, 8], [248, 8], [248, 120], [8, 120]], { ancho: 8, cerrado: true, seed: 6 })
  texturaFlecha = new THREE.CanvasTexture(c)
  texturaFlecha.colorSpace = THREE.SRGBColorSpace
  return texturaFlecha
}

/* --------------------------------- Boxes --------------------------------- */

const AMARILLO_CAJA = '#F4B33A'
/** One material per box color (the item categories), shared by every box of that color */
const materialesCaja = new Map()

/** A "?" painted with the brush on the box's color */
function texturaInterrogacion(color) {
  const { c, g } = lienzo(128, 128, { offscreen: false })
  g.fillStyle = color
  g.fillRect(0, 0, 128, 128)
  g.font = '400 100px "Caveat Brush", "Comic Sans MS", cursive'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 10
  g.strokeStyle = '#F1E6CC'
  g.strokeText('?', 64, 70)
  g.fillStyle = COLORES.tinta
  g.fillText('?', 64, 70)
  brush(g, [[10, 10], [118, 10], [118, 118], [10, 118]], { ancho: 7, cerrado: true, seed: 4 })
  const textura = new THREE.CanvasTexture(c)
  textura.colorSpace = THREE.SRGBColorSpace
  return textura
}

/** The material of a box of this color (the category's, or the classic yellow) */
export function materialCaja(color = AMARILLO_CAJA) {
  if (!materialesCaja.has(color)) {
    materialesCaja.set(color, new THREE.MeshToonMaterial({ map: texturaInterrogacion(color), gradientMap: toon('#fff').gradientMap }))
  }
  return materialesCaja.get(color)
}

export function crearCaja(color) {
  const caja = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.7), materialCaja(color))
  caja.castShadow = true
  return conContorno(caja, 0.07)
}
