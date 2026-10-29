import { blob, brush, fillShape, lienzo, rng, trazar } from '../pincel.js'
import { puntoEnPista } from '../compartido/pista'
import { COLORES } from './colores.js'

/**
 * The ground of the circuit (sand, road, dirt zones, start line), drawn ONCE with the brush
 * engine into a canvas that becomes the floor texture of the 3D scene. Walls, fence and
 * props are 3D objects (render3d/mundo.js), not part of the texture.
 * `escala` is pixels per meter; the caller keeps it under the GPU's max texture size.
 */
export function crearTexturaSuelo(pista, { escala = 8 } = {}) {
  const { limites } = pista.circuito
  const { c, g } = lienzo(limites.ancho * escala, limites.alto * escala, { offscreen: false })
  // From here on everything is drawn in meters
  g.setTransform(escala, 0, 0, escala, -limites.x * escala, -limites.y * escala)

  dibujarArena(g, limites)
  dibujarCamino(g, pista)
  dibujarZonas(g, pista.circuito)
  dibujarMeta(g, pista)
  return c
}

function dibujarArena(g, { x, y, ancho, alto }) {
  const random = rng(11)
  g.fillStyle = COLORES.arena
  g.fillRect(x, y, ancho, alto)

  // Darker sand patches
  for (let i = 0; i < (ancho * alto) / 1500; i++) {
    blob(g, x + random() * ancho, y + random() * alto, 4 + random() * 10, {
      relleno: COLORES.arenaOscura,
      contorno: null,
      irregular: 0.5,
      seed: i + 1,
    })
  }
  // Grain
  for (let i = 0; i < ancho * alto * 0.25; i++) {
    g.fillStyle = random() < 0.5 ? 'rgba(34,23,15,0.12)' : 'rgba(255,248,230,0.18)'
    g.fillRect(x + random() * ancho, y + random() * alto, 0.25, 0.25)
  }
  // Dry grass tufts: three short strokes from a point
  g.strokeStyle = 'rgba(94,72,40,0.55)'
  g.lineWidth = 0.12
  g.lineCap = 'round'
  g.beginPath()
  for (let i = 0; i < (ancho * alto) / 120; i++) {
    const px = x + random() * ancho
    const py = y + random() * alto
    for (let k = -1; k <= 1; k++) {
      g.moveTo(px, py)
      g.lineTo(px + k * 0.5 + (random() - 0.5) * 0.3, py - 0.7 - random() * 0.4)
    }
  }
  g.stroke()
}

/** Points of the centerline moved `lateral` meters to its right */
function desplazada(pista, lateral) {
  const { puntos } = pista
  const n = puntos.length
  return puntos.map(([x, y], i) => {
    const [ax, ay] = puntos[(i - 1 + n) % n]
    const [bx, by] = puntos[(i + 1) % n]
    const a = Math.atan2(by - ay, bx - ax)
    return [x - Math.sin(a) * lateral, y + Math.cos(a) * lateral]
  })
}

function dibujarCamino(g, pista) {
  const { puntos, mitad, longitud } = pista
  const random = rng(23)

  // Shoulder, then asphalt on top: two thick strokes along the centerline
  g.save()
  g.lineJoin = 'round'
  for (const [color, ancho] of [[COLORES.orilla, mitad * 2 + 1.8], [COLORES.asfalto, mitad * 2]]) {
    g.strokeStyle = color
    g.lineWidth = ancho
    g.beginPath()
    trazar(g, puntos, true)
    g.stroke()
  }
  g.restore()

  // Asphalt grain
  for (let i = 0; i < longitud * 6; i++) {
    const p = puntoEnPista(pista, random() * longitud, (random() - 0.5) * mitad * 1.9)
    g.fillStyle = random() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(241,230,204,0.08)'
    g.fillRect(p.x, p.y, 0.3, 0.3)
  }

  // Inked outer edges and painted edge lines
  for (const lado of [-1, 1]) {
    brush(g, desplazada(pista, lado * (mitad + 0.9)), { ancho: 0.35, temblor: 0.12, cerrado: true, seed: 3 + lado })
    brush(g, desplazada(pista, lado * (mitad - 0.6)), {
      color: COLORES.crema,
      ancho: 0.25,
      temblor: 0.08,
      alpha: 0.75,
      cerrado: true,
      seed: 5 + lado,
    })
  }

  // Dashed center line
  for (let s = 0, i = 0; s < longitud - 4; s += 9, i++) {
    const tramo = [0, 1.5, 3, 4.5].map((d) => puntoEnPista(pista, s + d)).map((p) => [p.x, p.y])
    brush(g, tramo, { color: COLORES.linea, ancho: 0.32, temblor: 0.05, pasadas: 1, seed: i + 1 })
  }
}

function dibujarZonas(g, circuito) {
  circuito.superficies.forEach((zona, i) => {
    if (zona.tipo !== 'tierra') return
    fillShape(g, zona.poligono, {
      relleno: COLORES.tierra,
      contorno: 'rgba(34,23,15,0.45)',
      anchoContorno: 0.3,
      paso: 2,
      temblor: 0.5,
      achurado: { separacion: 0.9, ancho: 0.12, alpha: 0.22 },
      seed: 40 + i,
    })
  })
}

/** Checkered start/finish line across the road at s = 0 */
function dibujarMeta(g, pista) {
  const p = puntoEnPista(pista, 0)
  g.save()
  g.translate(p.x, p.y)
  g.rotate(p.angulo)
  const lado = 1
  for (let fila = 0; fila < 2; fila++) {
    for (let k = -pista.mitad, j = 0; k < pista.mitad; k += lado, j++) {
      g.fillStyle = (fila + j) % 2 ? COLORES.tinta : COLORES.crema
      g.fillRect(fila * lado - lado, k, lado, lado)
    }
  }
  g.restore()
}
