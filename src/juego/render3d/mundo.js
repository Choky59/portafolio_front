import * as THREE from 'three'
import { crearSaguaro, rng } from '../../three/piezas.js'
import { COLORES } from '../render/colores.js'
import { crearTexturaSuelo } from '../render/mapa.js'
import { conContorno, pieza, toon } from './materiales.js'

/**
 * Everything that doesn't move, built once: the brush-drawn floor, walls, the fence around
 * the world, props from the circuit JSON and hills on the horizon.
 * Physics (x, y) maps to world (x, z); y is up.
 */
const ALTO_MURO = 2.4

export function crearMundo(pista, renderer) {
  const mundo = new THREE.Group()
  const { circuito } = pista
  const { limites } = circuito

  mundo.add(crearSuelo(limites, pista, renderer))
  mundo.add(crearLlanura(limites))
  mundo.add(crearCerros(limites))
  circuito.muros.forEach((linea, i) => mundo.add(crearMuro(linea, i)))
  mundo.add(crearCerca(limites))
  circuito.decoracion.forEach((d, i) => {
    const crear = DECORACION[d.tipo] ?? DECORACION.desconocido
    const objeto = crear(d.escala ?? 1, rng((i + 1) * 7))
    objeto.position.set(d.x, 0, d.y)
    objeto.rotation.y = d.rotacion ?? rng(i + 3)() * Math.PI * 2
    mundo.add(objeto)
  })
  return mundo
}

/** The brush-drawn ground as a texture on a plane the size of the world */
function crearSuelo(limites, pista, renderer) {
  // As sharp as the GPU allows, up to 8 px per meter
  const maximo = renderer.capabilities.maxTextureSize
  const escala = Math.min(8, Math.floor(maximo / Math.max(limites.ancho, limites.alto)))
  const textura = new THREE.CanvasTexture(crearTexturaSuelo(pista, { escala }))
  textura.colorSpace = THREE.SRGBColorSpace
  textura.anisotropy = renderer.capabilities.getMaxAnisotropy()

  // PlaneGeometry rotated flat: its top edge (image row 0) ends at -z, which is the smallest y
  const geo = new THREE.PlaneGeometry(limites.ancho, limites.alto).rotateX(-Math.PI / 2)
  const suelo = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: textura }))
  suelo.position.set(limites.x + limites.ancho / 2, 0, limites.y + limites.alto / 2)
  suelo.receiveShadow = true
  return suelo
}

/** Plain sand from the fence to the horizon */
function crearLlanura(limites) {
  const llanura = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: COLORES.arenaOscura }),
  )
  llanura.position.set(limites.x + limites.ancho / 2, -0.05, limites.y + limites.alto / 2)
  return llanura
}

/** Faceted hills in a ring around the world */
function crearCerros(limites) {
  const random = rng(19)
  const grupo = new THREE.Group()
  const cx = limites.x + limites.ancho / 2
  const cz = limites.y + limites.alto / 2
  const radio = Math.max(limites.ancho, limites.alto) / 2 + 90
  const material = new THREE.MeshLambertMaterial({ color: '#C29A6B', flatShading: true })
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + random() * 0.1
    const d = radio + random() * 120
    const alto = 25 + random() * 55
    const cerro = new THREE.Mesh(new THREE.ConeGeometry(35 + random() * 40, alto, 5 + Math.floor(random() * 3)), material)
    cerro.position.set(cx + Math.cos(a) * d, alto / 2 - 2, cz + Math.sin(a) * d)
    cerro.rotation.y = random() * Math.PI
    grupo.add(cerro)
  }
  return grupo
}

/** A closed polyline becomes a solid block; an open one, a wall along it */
function crearMuro(linea, i) {
  const cerrado = linea.length > 2 && linea[0][0] === linea.at(-1)[0] && linea[0][1] === linea.at(-1)[1]
  if (cerrado) {
    const forma = new THREE.Shape(linea.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)))
    // Extrude along z, then lay it down: footprint (x, y) → (x, z), height 0 … ALTO_MURO
    const geo = new THREE.ExtrudeGeometry(forma, { depth: ALTO_MURO, bevelEnabled: false })
      .rotateX(Math.PI / 2)
      .translate(0, ALTO_MURO, 0)
    return pieza(geo, COLORES.muro, { grosor: 0.12 })
  }
  const grupo = new THREE.Group()
  for (let k = 1; k < linea.length; k++) {
    const [ax, ay] = linea[k - 1]
    const [bx, by] = linea[k]
    const largo = Math.hypot(bx - ax, by - ay)
    const tramo = pieza(new THREE.BoxGeometry(largo, ALTO_MURO, 1), COLORES.muro, { grosor: 0.1 })
    tramo.position.set((ax + bx) / 2, ALTO_MURO / 2, (ay + by) / 2)
    tramo.rotation.y = -Math.atan2(by - ay, bx - ax)
    grupo.add(tramo)
  }
  grupo.name = `muro-${i}`
  return grupo
}

/** Wooden fence along the world limits: posts every 5 m and two rails */
function crearCerca(limites) {
  const grupo = new THREE.Group()
  const madera = '#8A6A45'
  const { x, y, ancho, alto } = limites
  const m = 0.8
  const esquinas = [[x + m, y + m], [x + ancho - m, y + m], [x + ancho - m, y + alto - m], [x + m, y + alto - m]]

  const postes = []
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = esquinas[i]
    const [bx, by] = esquinas[(i + 1) % 4]
    const largo = Math.hypot(bx - ax, by - ay)
    for (let d = 0; d < largo; d += 5) postes.push([ax + ((bx - ax) * d) / largo, ay + ((by - ay) * d) / largo])
    for (const h of [0.6, 1.15]) {
      const riel = pieza(new THREE.BoxGeometry(largo, 0.16, 0.12), madera, { grosor: 0.04 })
      riel.position.set((ax + bx) / 2, h, (ay + by) / 2)
      riel.rotation.y = -Math.atan2(by - ay, bx - ax)
      grupo.add(riel)
    }
  }
  // Hundreds of posts: one instanced mesh (and one for their outline)
  const geo = new THREE.BoxGeometry(0.3, 1.5, 0.3).translate(0, 0.75, 0)
  const instancias = new THREE.InstancedMesh(geo, toon(madera), postes.length)
  instancias.castShadow = true
  const matriz = new THREE.Matrix4()
  postes.forEach(([px, pz], i) => instancias.setMatrixAt(i, matriz.makeTranslation(px, 0, pz)))
  grupo.add(conContorno(instancias, 0.04))
  return grupo
}

/**
 * 3D props by `tipo` (circuit JSON). New ones (cathedral, kiosk, hot dog stands, the parked
 * bus…) are added here without touching anything else.
 */
const DECORACION = {
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
    const geo = new THREE.IcosahedronGeometry(1.6 * escala, 0).scale(1, 0.55 + random() * 0.3, 1)
    const piedra = pieza(geo, COLORES.piedra, { grosor: 0.08 })
    piedra.position.y = 0.3
    const grupo = new THREE.Group()
    grupo.add(piedra)
    return grupo
  },

  /** Fallback for a tipo nobody has modeled yet: a magenta box, so it shows up while building */
  desconocido(escala) {
    const grupo = new THREE.Group()
    const caja = pieza(new THREE.BoxGeometry(3 * escala, 3 * escala, 3 * escala), '#ff00ff')
    caja.position.y = 1.5 * escala
    grupo.add(caja)
    return grupo
  },
}
