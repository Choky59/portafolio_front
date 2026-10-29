import * as THREE from 'three'
import { rng } from '../../three/piezas.js'
import { alturaEn, puntosMuro } from '../compartido/pista'
import { COLORES } from '../render/colores.js'
import { crearTexturaSuelo } from '../render/mapa.js'
import { DECORACION } from './decoracion.js'
import { conContorno, pieza, toon } from './materiales.js'

/**
 * Everything that doesn't move, built once: the brush-drawn floor (with its hills), walls and
 * buildings, the fence around the world, props from the circuit JSON and hills on the horizon.
 * Physics (x, y) maps to world (x, z); y is up. The ground height comes from alturaEn(), the
 * same shared function the server uses for the camera.
 */
const ALTO_MURO = 2.4
/** Ground mesh resolution (meters between vertices) */
const PASO_SUELO = 4
/** Pixel budget of the ground texture (~12 Mpx ≈ 48 MB of GPU memory) */
const MAX_PIXELES = 12e6

export function crearMundo(pista, renderer) {
  const mundo = new THREE.Group()
  const { circuito } = pista
  const { limites } = circuito
  const altura = (x, y) => alturaEn(pista, x, y)

  mundo.add(crearSuelo(limites, pista, renderer, altura))
  mundo.add(crearLlanura(limites))
  mundo.add(crearCerros(limites))
  circuito.muros.forEach((muro, i) => {
    if (!muro.oculto) mundo.add(crearMuro(muro, i, altura))
  })
  mundo.add(crearCerca(limites, altura))
  circuito.decoracion.forEach((d, i) => {
    const crear = DECORACION[d.tipo] ?? DECORACION.desconocido
    const objeto = crear(d.escala ?? 1, rng((i + 1) * 7))
    objeto.position.set(d.x, altura(d.x, d.y), d.y)
    objeto.rotation.y = d.rotacion ?? (DECORACION_ORIENTADA.has(d.tipo) ? 0 : rng(i + 3)() * Math.PI * 2)
    mundo.add(objeto)
  })
  return mundo
}

/** Props whose front matters keep rotation 0 unless the JSON says otherwise */
const DECORACION_ORIENTADA = new Set(['catedral', 'kiosco', 'mirador', 'camion', 'puesto-dogos', 'senal'])

/** The brush-drawn ground as a texture on a mesh the size of the world, lifted by the hills */
function crearSuelo(limites, pista, renderer, altura) {
  // As sharp as the GPU and the pixel budget allow, up to 8 px per meter
  const maximo = renderer.capabilities.maxTextureSize
  const escala = Math.max(
    2,
    Math.min(8, Math.floor(maximo / Math.max(limites.ancho, limites.alto)), Math.floor(Math.sqrt(MAX_PIXELES / (limites.ancho * limites.alto)))),
  )
  const textura = new THREE.CanvasTexture(crearTexturaSuelo(pista, { escala }))
  textura.colorSpace = THREE.SRGBColorSpace
  textura.anisotropy = renderer.capabilities.getMaxAnisotropy()

  // PlaneGeometry rotated flat: its top edge (image row 0) ends at -z, which is the smallest y
  const geo = new THREE.PlaneGeometry(
    limites.ancho,
    limites.alto,
    Math.ceil(limites.ancho / PASO_SUELO),
    Math.ceil(limites.alto / PASO_SUELO),
  ).rotateX(-Math.PI / 2)
  const cx = limites.x + limites.ancho / 2
  const cz = limites.y + limites.alto / 2
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setY(i, altura(pos.getX(i) + cx, pos.getZ(i) + cz))
  geo.computeVertexNormals()

  const suelo = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: textura }))
  suelo.position.set(cx, 0, cz)
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

/**
 * A closed polyline becomes a solid block (a building, with its own height and color); an open
 * one, a wall along it. The base sits at the lowest ground under it, so it never floats.
 */
function crearMuro(muro, i, altura) {
  const linea = puntosMuro(muro)
  const alto = muro.alto ?? ALTO_MURO
  const color = muro.color ?? COLORES.muro
  const base = Math.min(...linea.map(([x, y]) => altura(x, y)))
  const cerrado = linea.length > 2 && linea[0][0] === linea.at(-1)[0] && linea[0][1] === linea.at(-1)[1]
  if (cerrado) {
    const forma = new THREE.Shape(linea.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)))
    // Extrude along z, then lay it down: footprint (x, y) → (x, z), height base … base + alto
    const geo = new THREE.ExtrudeGeometry(forma, { depth: alto + 1, bevelEnabled: false })
      .rotateX(Math.PI / 2)
      .translate(0, base + alto, 0)
    return pieza(geo, color, { grosor: 0.12 })
  }
  const grupo = new THREE.Group()
  for (let k = 1; k < linea.length; k++) {
    const [ax, ay] = linea[k - 1]
    const [bx, by] = linea[k]
    const largo = Math.hypot(bx - ax, by - ay)
    const tramo = pieza(new THREE.BoxGeometry(largo, alto + 1, 1), color, { grosor: 0.1 })
    tramo.position.set((ax + bx) / 2, base + (alto - 1) / 2, (ay + by) / 2)
    tramo.rotation.y = -Math.atan2(by - ay, bx - ax)
    grupo.add(tramo)
  }
  grupo.name = `muro-${i}`
  return grupo
}

/** Wooden fence along the world limits: posts every 5 m and two rails, following the ground */
function crearCerca(limites, altura) {
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
  }

  // Hundreds of posts and rail pieces: instanced meshes (each with its instanced outline)
  const matriz = new THREE.Matrix4()
  const posicion = new THREE.Vector3()
  const giro = new THREE.Quaternion()
  const uno = new THREE.Vector3(1, 1, 1)
  const arriba = new THREE.Vector3(0, 1, 0)

  const palos = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1.5, 0.3).translate(0, 0.75, 0), toon(madera), postes.length)
  palos.castShadow = true
  postes.forEach(([px, pz], i) => palos.setMatrixAt(i, matriz.makeTranslation(px, altura(px, pz), pz)))

  const rieles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.16, 0.12), toon(madera), postes.length * 2)
  postes.forEach(([ax, az], i) => {
    const [bx, bz] = postes[(i + 1) % postes.length]
    const largo = Math.hypot(bx - ax, bz - az)
    const mx = (ax + bx) / 2
    const mz = (az + bz) / 2
    giro.setFromAxisAngle(arriba, -Math.atan2(bz - az, bx - ax))
    for (const [k, h] of [[0, 0.6], [1, 1.15]]) {
      posicion.set(mx, altura(mx, mz) + h, mz)
      rieles.setMatrixAt(i * 2 + k, matriz.compose(posicion, giro, uno.set(largo, 1, 1)))
    }
  })

  const grupo = new THREE.Group()
  grupo.add(conContorno(palos, 0.04), conContorno(rieles, 0.04))
  return grupo
}
