import { brush, fillShape, lienzo } from '../pincel.js'
import { prepararPista } from '../compartido/pista'
import { COLORES } from './colores.js'

/**
 * A small brush-drawn map of a circuit for the lobby: sand, water and the road's shape with
 * its start line. Cached as an image URL per circuit.
 */
const ANCHO = 240
const ALTO = 150
const cache = new Map()

export function miniMapa(circuito) {
  if (cache.has(circuito.id)) return cache.get(circuito.id)
  const pista = prepararPista(circuito)
  const { c, g } = lienzo(ANCHO, ALTO, { offscreen: false })

  // Fit the track (plus a margin) into the picture
  const xs = pista.puntos.map((p) => p[0])
  const ys = pista.puntos.map((p) => p[1])
  const margen = 40
  const [x0, x1, y0, y1] = [Math.min(...xs) - margen, Math.max(...xs) + margen, Math.min(...ys) - margen, Math.max(...ys) + margen]
  const escala = Math.min(ANCHO / (x1 - x0), ALTO / (y1 - y0))
  g.setTransform(escala, 0, 0, escala, (ANCHO - (x1 - x0) * escala) / 2 - x0 * escala, (ALTO - (y1 - y0) * escala) / 2 - y0 * escala)

  g.fillStyle = COLORES.arena
  g.fillRect(x0 - 500, y0 - 500, x1 - x0 + 1000, y1 - y0 + 1000)
  for (const [i, agua] of (circuito.agua ?? []).entries()) {
    fillShape(g, agua, { relleno: '#5AA2CC', contorno: '#F4F1E8', anchoContorno: 3 / escala, temblor: 1, seed: i + 1 })
  }
  const linea = [...pista.puntos, pista.puntos[0]]
  brush(g, linea, { color: COLORES.tinta, ancho: circuito.ancho + 6 / escala, temblor: 0.5, pasadas: 1, seed: 2 })
  brush(g, linea, { color: COLORES.asfalto, ancho: circuito.ancho, temblor: 0.3, pasadas: 1, seed: 3 })
  // Start line
  const [sx, sy] = pista.puntos[0]
  const [nx, ny] = pista.puntos[1]
  const a = Math.atan2(ny - sy, nx - sx)
  const m = circuito.ancho * 0.7
  brush(g, [[sx - Math.sin(a) * m, sy + Math.cos(a) * m], [sx + Math.sin(a) * m, sy - Math.cos(a) * m]], {
    color: COLORES.crema,
    ancho: 4 / escala,
    pasadas: 1,
    seed: 4,
  })

  const url = c.toDataURL('image/png')
  cache.set(circuito.id, url)
  return url
}
