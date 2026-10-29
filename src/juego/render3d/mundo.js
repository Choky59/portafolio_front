import * as THREE from 'three'
import { rng } from '../../three/piezas.js'
import { NIVEL_AGUA, alturaEn, puntosMuro } from '../compartido/pista'
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

  const suelo = crearSuelo(limites, pista, renderer, altura)
  mundo.add(suelo)
  // For aiming at the ground (the spectators' meteors)
  mundo.userData.suelo = suelo
  mundo.add(crearLlanura(limites))
  mundo.add(crearCerros(limites))
  circuito.muros.forEach((muro, i) => {
    if (!muro.oculto) mundo.add(crearMuro(muro, i, altura))
  })
  mundo.add(crearCerca(limites, altura))
  for (const agua of circuito.agua ?? []) mundo.add(crearAgua(agua))
  for (const rampa of circuito.rampas ?? []) mundo.add(crearRampa(rampa, altura))
  circuito.decoracion.forEach((d, i) => {
    const crear = DECORACION[d.tipo] ?? DECORACION.desconocido
    const objeto = crear(d.escala ?? 1, rng((i + 1) * 7))
    // Boats float on the water's surface; everything else stands on the ground
    objeto.position.set(d.x, d.flota ? NIVEL_AGUA : altura(d.x, d.y), d.y)
    objeto.rotation.y = d.rotacion ?? (DECORACION_ORIENTADA.has(d.tipo) ? 0 : rng(i + 3)() * Math.PI * 2)
    mundo.add(objeto)
  })
  return mundo
}

/** Props whose front matters keep rotation 0 unless the JSON says otherwise */
const DECORACION_ORIENTADA = new Set(['catedral', 'kiosco', 'mirador', 'camion', 'puesto-dogos', 'senal', 'velero', 'lancha'])

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

/**
 * The water's surface: a translucent plane at sea level over the water polygon. The ground
 * under it sinks from the shore (alturaEn), and its brush-painted blue shows through as depth.
 */
function crearAgua(poligono) {
  const forma = new THREE.Shape(poligono.map(([x, y]) => new THREE.Vector2(x, y)))
  // Shape lives in x-y: rotated, (x, y) lands on (x, z)
  const geo = new THREE.ShapeGeometry(forma).rotateX(Math.PI / 2).translate(0, NIVEL_AGUA, 0)
  const agua = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ color: '#5AA2CC', transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  )
  agua.receiveShadow = true
  return agua
}

/**
 * A jump ramp: a wooden wedge from its foot at (x, y) up `alto` m over `largo` m, in the direction
 * `angulo`. Like the physics (the car's height on it is measured from the ground under it), its
 * top is the terrain plus the ramp's height at each point: on a hillside it follows the hill
 * instead of sinking into it. Built straight in world coordinates, with ink edges, planks across
 * and yellow and black stripes on the lip.
 */
function crearRampa(r, altura) {
  const fx = Math.cos(r.angulo)
  const fy = Math.sin(r.angulo)
  const punto = (a, l, arriba) => {
    const x = r.x + fx * a - fy * l
    const y = r.y + fy * a + fx * l
    return [x, altura(x, y) + arriba, y]
  }
  const N = 8
  const w = r.ancho / 2
  const encima = (i, l, extra = 0) => punto((r.largo * i) / N, l, (r.alto * i) / N + extra)
  // The sides go a bit into the ground, so no gap shows on uneven terrain
  const debajo = (i, l) => punto((r.largo * i) / N, l, -0.3)

  const posiciones = []
  const cara = (a, b, c, d) => posiciones.push(...a, ...b, ...c, ...a, ...c, ...d)
  for (let i = 0; i < N; i++) {
    cara(encima(i, -w), encima(i, w), encima(i + 1, w), encima(i + 1, -w))
    cara(debajo(i, -w), encima(i, -w), encima(i + 1, -w), debajo(i + 1, -w))
    cara(debajo(i, w), debajo(i + 1, w), encima(i + 1, w), encima(i, w))
  }
  cara(debajo(N, -w), encima(N, -w), encima(N, w), debajo(N, w))
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3))
  geo.computeVertexNormals()
  const material = toon('#A07848').clone()
  material.side = THREE.DoubleSide
  const cuna = new THREE.Mesh(geo, material)
  cuna.castShadow = true
  cuna.receiveShadow = true

  const grupo = new THREE.Group()
  grupo.add(cuna)
  // Ink: the outer edges and a plank line across the top at each step
  const lineas = []
  const linea = (a, b) => lineas.push(...a, ...b)
  for (const l of [-w, w]) for (let i = 0; i < N; i++) linea(encima(i, l, 0.02), encima(i + 1, l, 0.02))
  for (let i = 1; i <= N; i++) linea(encima(i, -w, 0.02), encima(i, w, 0.02))
  for (const l of [-w, w]) linea(encima(N, l), debajo(N, l))
  const tinta = new THREE.BufferGeometry()
  tinta.setAttribute('position', new THREE.Float32BufferAttribute(lineas, 3))
  grupo.add(new THREE.LineSegments(tinta, new THREE.LineBasicMaterial({ color: COLORES.tinta })))

  // Yellow and black stripes on the lip, so it reads as "jump here"
  for (let k = 0; k < 6; k++) {
    const l = -w + (r.ancho / 6) * (k + 0.5)
    const franja = pieza(new THREE.BoxGeometry(0.3, 0.12, r.ancho / 6), k % 2 ? COLORES.tinta : '#F6C445', { grosor: 0.005, sombra: false })
    franja.position.set(...encima(N, l, 0.05))
    franja.rotation.y = -r.angulo
    grupo.add(franja)
  }
  return grupo
}

/**
 * Plain sand from the fence to the horizon. It has a hole the size of the world, so it never
 * covers the ground inside (which sinks under the sea, below this plain's height).
 */
function crearLlanura({ x, y, ancho, alto }) {
  const cx = x + ancho / 2
  const cy = y + alto / 2
  const forma = new THREE.Shape().moveTo(cx - 1500, cy - 1500).lineTo(cx + 1500, cy - 1500).lineTo(cx + 1500, cy + 1500).lineTo(cx - 1500, cy + 1500)
  forma.holes.push(new THREE.Path().moveTo(x, y).lineTo(x + ancho, y).lineTo(x + ancho, y + alto).lineTo(x, y + alto))
  // Shape lives in x-y: rotated, (x, y) lands on (x, z)
  const geo = new THREE.ShapeGeometry(forma).rotateX(Math.PI / 2).translate(0, -0.05, 0)
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: COLORES.arenaOscura, side: THREE.DoubleSide }))
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
