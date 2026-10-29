import { blob, brush, fillShape, hatch, lienzo, rng, trazar } from '../pincel.js'
import { alturaEn, puntoEnPista } from '../compartido/pista'
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
  dibujarRelieve(g, pista)
  dibujarBarrancos(g, pista.circuito)
  dibujarCamino(g, pista)
  dibujarZonas(g, pista)
  dibujarMeta(g, pista)
  return c
}

/**
 * Hills drawn like a sketch: short strokes along the contour lines where the ground is steep,
 * heavier on the slopes facing away from the afternoon sun (west), and rocks near the top.
 */
function dibujarRelieve(g, pista) {
  if (!pista.circuito.elevacion?.length) return
  const random = rng(31)
  const { x: x0, y: y0, ancho, alto } = pista.circuito.limites
  const paso = 2.5
  g.save()
  g.strokeStyle = COLORES.tinta
  g.lineCap = 'round'
  for (let y = y0; y < y0 + alto; y += paso) {
    for (let x = x0; x < x0 + ancho; x += paso) {
      // Higher ground gets a deeper ochre, so the hills read from afar
      const h = alturaEn(pista, x + paso / 2, y + paso / 2)
      if (h > 1) {
        g.globalAlpha = Math.min(0.45, h / 90)
        g.fillStyle = '#A97E4C'
        g.fillRect(x, y, paso + 0.05, paso + 0.05)
      }
      const px = x + random() * paso
      const py = y + random() * paso
      const gx = (alturaEn(pista, px + 1, py) - alturaEn(pista, px - 1, py)) / 2
      const gy = (alturaEn(pista, px, py + 1) - alturaEn(pista, px, py - 1)) / 2
      const pendiente = Math.hypot(gx, gy)
      if (pendiente < 0.06) continue
      // Contour direction: perpendicular to the gradient
      const cx = -gy / pendiente
      const cy = gx / pendiente
      const sombra = gx < 0 ? 1.3 : 0.6
      g.globalAlpha = Math.min(0.4, pendiente * 0.9) * sombra
      g.lineWidth = 0.18
      g.beginPath()
      g.moveTo(px - cx * 0.9, py - cy * 0.9)
      g.lineTo(px + cx * 0.9 + (random() - 0.5) * 0.3, py + cy * 0.9 + (random() - 0.5) * 0.3)
      g.stroke()
      // Rocks scattered on the high slopes
      if (alturaEn(pista, px, py) > 14 && random() < 0.05) {
        g.globalAlpha = 1
        blob(g, px, py, 0.5 + random() * 1.2, {
          relleno: COLORES.piedra,
          anchoContorno: 0.12,
          irregular: 0.4,
          seed: Math.floor(random() * 1e6),
        })
      }
    }
  }
  g.restore()
}

/** Cliffs: a dark, densely hatched drop with an inked rim */
function dibujarBarrancos(g, circuito) {
  circuito.barrancos.forEach((barranco, i) => {
    fillShape(g, barranco, {
      relleno: '#7A5634',
      anchoContorno: 0.5,
      paso: 2,
      temblor: 0.6,
      achurado: { separacion: 0.6, ancho: 0.15, alpha: 0.5, angulo: 0.9 },
      seed: 80 + i,
    })
    hatch(g, barranco, { separacion: 1.1, ancho: 0.12, alpha: 0.35, angulo: -0.7, seed: 90 + i })
  })
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

/** Zones over the road: dirt, the dry riverbed, sidewalks and the plaza */
function dibujarZonas(g, pista) {
  pista.circuito.superficies.forEach((zona, i) => {
    const dibujar = ESTILOS_ZONA[zona.estilo] ?? (zona.tipo === 'tierra' ? ESTILOS_ZONA.tierra : null)
    dibujar?.(g, zona, 40 + i, pista)
  })
}

const ESTILOS_ZONA = {
  tierra(g, zona, seed) {
    fillShape(g, zona.poligono, {
      relleno: COLORES.tierra,
      contorno: 'rgba(34,23,15,0.45)',
      anchoContorno: 0.3,
      paso: 2,
      temblor: 0.5,
      achurado: { separacion: 0.9, ancho: 0.12, alpha: 0.22 },
      seed,
    })
  },

  /** Vado del Río: pale dry riverbed with pebbles, a thin stream and the ruts of the cars */
  rio(g, zona, seed, pista) {
    const random = rng(seed)
    fillShape(g, zona.poligono, {
      relleno: '#CDB487',
      contorno: 'rgba(34,23,15,0.4)',
      anchoContorno: 0.35,
      paso: 3,
      temblor: 1.2,
      seed,
    })
    g.save()
    g.beginPath()
    trazar(g, zona.poligono, true)
    g.clip()
    const xs = zona.poligono.map((p) => p[0])
    const ys = zona.poligono.map((p) => p[1])
    for (let k = 0; k < 900; k++) {
      const x = Math.min(...xs) + random() * (Math.max(...xs) - Math.min(...xs))
      const y = Math.min(...ys) + random() * (Math.max(...ys) - Math.min(...ys))
      blob(g, x, y, 0.2 + random() * 0.6, {
        relleno: random() < 0.5 ? '#B9A27C' : '#A89878',
        anchoContorno: 0.06,
        irregular: 0.4,
        seed: k + 1,
      })
    }
    // Ruts across the riverbed where the road goes
    for (const lado of [-3, 3]) {
      const huella = []
      for (let s = 0; s < pista.longitud; s += 2) {
        const p = puntoEnPista(pista, s, lado)
        huella.push([p.x, p.y])
      }
      brush(g, huella, { color: '#8F7350', ancho: 1.1, temblor: 0.3, alpha: 0.45, cerrado: true, seed: seed + lado })
    }
    if (zona.cauce) {
      brush(g, zona.cauce, { color: '#6FA3C8', ancho: 2.4, paso: 3, temblor: 0.5, pasadas: 2, seed: seed + 5 })
      brush(g, zona.cauce, { color: '#A9CFE6', ancho: 0.6, paso: 3, temblor: 0.3, pasadas: 1, seed: seed + 6 })
    }
    g.restore()
  },

  /** Centro sidewalks: pale concrete slabs with joints and a curb */
  banqueta(g, zona, seed) {
    // `paso` subdivides the sides, so the smooth stroke keeps the rectangle's corners
    fillShape(g, zona.poligono, { relleno: '#DCCFB4', contorno: null, paso: 1, temblor: 0.1, seed })
    hatch(g, zona.poligono, { separacion: 2, ancho: 0.08, alpha: 0.3, angulo: Math.PI / 2, seed })
    brush(g, [...zona.poligono, zona.poligono[0]], { ancho: 0.2, temblor: 0.05, alpha: 0.6, seed: seed + 1 })
  },

  /** Plaza Zaragoza: diamond-patterned paving */
  plaza(g, zona, seed) {
    fillShape(g, zona.poligono, { relleno: '#E6D6B2', anchoContorno: 0.3, paso: 1.5, temblor: 0.12, seed })
    hatch(g, zona.poligono, { separacion: 3, ancho: 0.1, alpha: 0.25, angulo: Math.PI / 4, seed: seed + 1 })
    hatch(g, zona.poligono, { separacion: 3, ancho: 0.1, alpha: 0.25, angulo: -Math.PI / 4, seed: seed + 2 })
  },
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
