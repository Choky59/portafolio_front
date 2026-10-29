import * as THREE from 'three'
import { COLORES } from '../render/colores.js'
import { brush, lienzo } from '../pincel.js'
import { conContorno, pieza, toon } from './materiales.js'

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
 * Each model: (item) → { grupo, animar?(t, vida), sobreSuelo? }. `sobreSuelo` (its size in m)
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

  /** Bache: a dark broken patch with cracks */
  bache(item) {
    const g = new THREE.Group()
    g.add(calcomania((item.radio ?? 2) + 0.4, '#5C4834', 1, 10, 0.25))
    const hoyo = calcomania(item.radio ?? 2, COLORES.tinta, 1, 10, 0.3)
    hoyo.position.y = 0.01
    g.add(hoyo)
    for (let i = 0; i < 4; i++) {
      const grieta = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.12).rotateX(-Math.PI / 2), hoyo.material)
      grieta.rotation.y = i * 1.4
      grieta.position.set(Math.cos(i * 1.4) * 2.2, 0.01, -Math.sin(i * 1.4) * 2.2)
      g.add(grieta)
    }
    return { grupo: g, sobreSuelo: (item.radio ?? 2) + 0.6 }
  },

  /** Charco de la tromba: a blue puddle with ripples */
  charco(item) {
    const g = new THREE.Group()
    const r = item.radio ?? 5
    g.add(calcomania(r + 0.25, COLORES.tinta, 0.6, 18, 0.12))
    const agua = calcomania(r, '#6FA3C8', 0.85, 18, 0.12)
    agua.position.y = 0.01
    g.add(agua)
    const ondas = []
    for (let i = 0; i < 2; i++) {
      const onda = new THREE.Mesh(
        new THREE.RingGeometry(1, 1.15, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#D7ECF7', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
      )
      onda.position.y = 0.02
      g.add(onda)
      ondas.push(onda)
    }
    return {
      grupo: g,
      sobreSuelo: r + 0.3,
      animar(t) {
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

export function crearModeloEntidad(item) {
  const crear = MODELOS[item.id] ?? MODELOS[POR_MECANICA[item.mecanica]]
  if (crear) return crear(item)
  const g = new THREE.Group()
  en(g, new THREE.SphereGeometry(1, 8, 6), '#ff00ff', 0, 1, 0)
  return { grupo: g }
}

/* --------------------------------- Boxes --------------------------------- */

let texturaCaja = null

/** A "?" painted with the brush on the brand's yellow */
function texturaInterrogacion() {
  if (texturaCaja) return texturaCaja
  const { c, g } = lienzo(128, 128, { offscreen: false })
  g.fillStyle = '#F4B33A'
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
  texturaCaja = new THREE.CanvasTexture(c)
  texturaCaja.colorSpace = THREE.SRGBColorSpace
  return texturaCaja
}

export function crearCaja() {
  const material = new THREE.MeshToonMaterial({ map: texturaInterrogacion(), gradientMap: toon('#fff').gradientMap })
  const caja = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.7), material)
  caja.castShadow = true
  return conContorno(caja, 0.07)
}
