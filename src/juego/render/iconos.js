import { blob, brush, circulo, fillShape, lienzo, rectangulo, splat } from '../pincel.js'
import { COLORES } from './colores.js'

/**
 * Item icons for the HUD and the lobby, painted with the brush engine on a small canvas and
 * cached as image URLs. One drawing per item id; unknown items get a round badge with their
 * initial, so a new item from items.json still has an icon.
 */
const TAM = 96
const cache = new Map()

const DIBUJOS = {
  burro(g) {
    blob(g, 46, 58, 24, { relleno: '#8A6A45', anchoContorno: 3, seed: 2 }) // head
    fillShape(g, [[30, 40], [24, 8], [38, 34]], { relleno: '#8A6A45', anchoContorno: 3, seed: 3 })
    fillShape(g, [[52, 36], [62, 6], [64, 38]], { relleno: '#8A6A45', anchoContorno: 3, seed: 4 })
    blob(g, 54, 72, 13, { relleno: '#D9C7A8', anchoContorno: 2.5, seed: 5 }) // muzzle
    blob(g, 38, 52, 3.5, { relleno: COLORES.tinta, contorno: null, seed: 6 })
    blob(g, 58, 50, 3.5, { relleno: COLORES.tinta, contorno: null, seed: 7 })
  },
  bache(g) {
    blob(g, 48, 52, 32, { relleno: '#5C4834', anchoContorno: 3, irregular: 0.35, seed: 3 })
    blob(g, 48, 52, 20, { relleno: COLORES.tinta, contorno: null, irregular: 0.4, seed: 4 })
    brush(g, [[20, 30], [34, 40], [30, 52]], { ancho: 3, seed: 5 })
    brush(g, [[76, 68], [64, 62], [70, 78]], { ancho: 3, seed: 6 })
  },
  charco(g) {
    blob(g, 48, 58, 34, { relleno: '#6FA3C8', anchoContorno: 3, irregular: 0.25, seed: 7 })
    blob(g, 40, 50, 10, { relleno: '#BFE0F2', contorno: null, seed: 8 })
    fillShape(g, [[56, 6], [66, 26], [46, 26]], { relleno: '#6FA3C8', anchoContorno: 2.5, seed: 9 }) // drop
  },
  calor(g) {
    splat(g, 48, 48, 40, { puntas: 10, interior: 0.62, relleno: '#E4572E', anchoContorno: 3, seed: 10 })
    blob(g, 48, 48, 22, { relleno: '#F6C445', anchoContorno: 2.5, seed: 11 })
  },
  humo(g) {
    for (const [x, y, r] of [[30, 46, 18], [54, 36, 22], [70, 54, 16], [46, 60, 18]]) {
      blob(g, x, y, r, { relleno: '#E8E2D4', anchoContorno: 2.5, seed: x })
    }
    fillShape(g, rectangulo(48, 82, 50, 10, -0.08), { relleno: '#9E2A14', anchoContorno: 2.5, seed: 12 }) // the carne asada
  },
  tope(g) {
    fillShape(g, rectangulo(48, 52, 80, 26), { relleno: '#F6C445', anchoContorno: 3, seed: 13 })
    for (let i = 0; i < 4; i++) fillShape(g, rectangulo(18 + i * 20, 52, 9, 26), { relleno: COLORES.tinta, contorno: null, seed: 14 + i })
  },
  coyotas(g) {
    for (const [x, y] of [[34, 40], [60, 46], [44, 64]]) {
      fillShape(g, circulo(x, y, 18, { ry: 12 }), { relleno: '#D9A55B', anchoContorno: 2.5, seed: x + y })
      blob(g, x + 4, y - 2, 3, { relleno: '#7A4A1E', contorno: null, seed: x })
    }
  },
  camion(g) {
    fillShape(g, rectangulo(48, 50, 80, 38), { relleno: '#F1E6CC', anchoContorno: 3, seed: 15 })
    fillShape(g, rectangulo(48, 58, 80, 8), { relleno: '#E4572E', contorno: null, seed: 16 })
    for (let i = 0; i < 4; i++) fillShape(g, rectangulo(20 + i * 17, 42, 11, 10), { relleno: '#2E2016', contorno: null, seed: 17 + i })
    blob(g, 26, 72, 8, { relleno: COLORES.tinta, contorno: null, seed: 21 })
    blob(g, 70, 72, 8, { relleno: COLORES.tinta, contorno: null, seed: 22 })
  },
}

export function iconoItem(item) {
  if (!item) return null
  if (cache.has(item.id)) return cache.get(item.id)
  const { c, g } = lienzo(TAM, TAM, { offscreen: false })
  const dibujar = DIBUJOS[item.id]
  if (dibujar) dibujar(g)
  else {
    blob(g, 48, 48, 36, { relleno: item.color, anchoContorno: 3, seed: 1 })
    g.font = '400 48px "Caveat Brush", cursive'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = COLORES.tinta
    g.fillText(item.nombre[0], 48, 52)
  }
  const url = c.toDataURL('image/png')
  cache.set(item.id, url)
  return url
}
