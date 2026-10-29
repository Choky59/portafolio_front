import { rng } from '../three/piezas.js'

/**
 * Brush engine: the brand's hand-drawn look on a 2D canvas.
 * Every shape is a list of points that gets "roughed up" (subdivided and jittered) and then
 * stroked in a few slightly different passes, like ink going over the same line twice.
 * Pass a `seed` to draw exactly the same shape every time (the map is drawn once, but sprites
 * and covers must not shimmer between renders).
 *
 * Coordinates are whatever the context's transform says: the map draws in meters, sprites in pixels.
 */

export { rng }

export const TINTA = '#22170F'

/* ---------------------------------- Shapes ---------------------------------- */

/** Points of a circle (or ellipse with `ry`) */
export function circulo(x, y, r, { lados = 20, ry = r, rotacion = 0 } = {}) {
  const puntos = []
  const c = Math.cos(rotacion)
  const s = Math.sin(rotacion)
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2
    const px = Math.cos(a) * r
    const py = Math.sin(a) * ry
    puntos.push([x + px * c - py * s, y + px * s + py * c])
  }
  return puntos
}

/** Points of a rectangle centered on x, y */
export function rectangulo(x, y, ancho, alto, rotacion = 0) {
  const c = Math.cos(rotacion)
  const s = Math.sin(rotacion)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
    const px = (u * ancho) / 2
    const py = (v * alto) / 2
    return [x + px * c - py * s, y + px * s + py * c]
  })
}

/**
 * Roughs up a line: subdivides it every `paso` units and moves each point up to `temblor`
 * units in a random direction. The ends of an open line stay closer to where they were.
 */
export function rough(puntos, { temblor = 1, paso = 0, cerrado = false, random = Math.random } = {}) {
  const base = paso > 0 ? subdividir(puntos, paso, cerrado) : puntos
  return base.map(([x, y], i) => {
    const extremo = !cerrado && (i === 0 || i === base.length - 1) ? 0.4 : 1
    return [x + (random() - 0.5) * 2 * temblor * extremo, y + (random() - 0.5) * 2 * temblor * extremo]
  })
}

function subdividir(puntos, paso, cerrado) {
  const salida = []
  const n = puntos.length
  const tramos = cerrado ? n : n - 1
  for (let i = 0; i < tramos; i++) {
    const [ax, ay] = puntos[i]
    const [bx, by] = puntos[(i + 1) % n]
    const partes = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / paso))
    for (let k = 0; k < partes; k++) salida.push([ax + ((bx - ax) * k) / partes, ay + ((by - ay) * k) / partes])
  }
  if (!cerrado) salida.push(puntos[n - 1])
  return salida
}

/** Adds the points as a smooth path (quadratic curves through the midpoints) */
export function trazar(ctx, puntos, cerrado = false) {
  const n = puntos.length
  if (n < 2) return
  if (n === 2 || !cerrado) {
    ctx.moveTo(puntos[0][0], puntos[0][1])
    for (let i = 1; i < n - 1; i++) {
      const [x, y] = puntos[i]
      const [nx, ny] = puntos[i + 1]
      ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
    }
    ctx.lineTo(puntos[n - 1][0], puntos[n - 1][1])
    return
  }
  const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const inicio = medio(puntos[n - 1], puntos[0])
  ctx.moveTo(inicio[0], inicio[1])
  for (let i = 0; i < n; i++) {
    const m = medio(puntos[i], puntos[(i + 1) % n])
    ctx.quadraticCurveTo(puntos[i][0], puntos[i][1], m[0], m[1])
  }
  ctx.closePath()
}

/* ---------------------------------- Strokes ---------------------------------- */

/**
 * Brush stroke along a line: `pasadas` passes, each one jittered a little differently and with
 * its own width and opacity, so the line looks inked by hand.
 */
export function brush(
  ctx,
  puntos,
  { color = TINTA, ancho = 2, pasadas = 2, temblor = ancho * 0.35, paso = 0, alpha = 1, cerrado = false, seed = 1 } = {},
) {
  const random = rng(seed)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 0; i < pasadas; i++) {
    ctx.globalAlpha = alpha * (i === 0 ? 1 : 0.45 + random() * 0.35)
    ctx.lineWidth = ancho * (i === 0 ? 1 : 0.5 + random() * 0.4)
    ctx.beginPath()
    trazar(ctx, rough(puntos, { temblor, paso, cerrado, random }), cerrado)
    ctx.stroke()
  }
  ctx.restore()
}

/** Diagonal hatching clipped to a polygon (shadows, dirt, texture) */
export function hatch(
  ctx,
  puntos,
  { color = TINTA, separacion = 6, angulo = -0.9, ancho = 1, alpha = 0.3, temblor = separacion * 0.15, seed = 1 } = {},
) {
  const random = rng(seed)
  const xs = puntos.map((p) => p[0])
  const ys = puntos.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const radio = Math.hypot(Math.max(...xs) - cx, Math.max(...ys) - cy)
  const dx = Math.cos(angulo)
  const dy = Math.sin(angulo)

  ctx.save()
  ctx.beginPath()
  trazar(ctx, puntos, true)
  ctx.clip()
  ctx.strokeStyle = color
  ctx.lineWidth = ancho
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha
  ctx.beginPath()
  for (let d = -radio; d <= radio; d += separacion) {
    // Each hatch line is perpendicular to (dx, dy) offset by d, with a little wobble
    const ox = cx - dy * d + (random() - 0.5) * temblor
    const oy = cy + dx * d + (random() - 0.5) * temblor
    ctx.moveTo(ox - dx * radio, oy - dy * radio)
    ctx.lineTo(ox + dx * radio, oy + dy * radio)
  }
  ctx.stroke()
  ctx.restore()
}

/* ---------------------------------- Fills ---------------------------------- */

/**
 * Filled shape: a roughed-up fill, optional hatching on top and an inked outline.
 * `contorno: null` skips the outline.
 */
export function fillShape(
  ctx,
  puntos,
  {
    relleno,
    contorno = TINTA,
    anchoContorno = 2,
    pasadas = 2,
    temblor = anchoContorno * 0.4,
    paso = 0,
    achurado = null,
    seed = 1,
  } = {},
) {
  const random = rng(seed)
  const forma = rough(puntos, { temblor: temblor * 0.6, paso, cerrado: true, random })
  if (relleno) {
    ctx.save()
    ctx.fillStyle = relleno
    ctx.beginPath()
    trazar(ctx, forma, true)
    ctx.fill()
    ctx.restore()
  }
  if (achurado) hatch(ctx, forma, { seed: seed + 7, ...achurado })
  if (contorno) brush(ctx, forma, { color: contorno, ancho: anchoContorno, pasadas, temblor, cerrado: true, seed: seed + 13 })
}

/** Wobbly round blob (bushes, smoke, stones, splats of paint) */
export function blob(ctx, x, y, r, { irregular = 0.18, lados = 14, seed = 1, ...opciones } = {}) {
  const random = rng(seed * 31 + 3)
  const fase = random() * Math.PI * 2
  const puntos = circulo(x, y, r, { lados }).map(([px, py], i) => {
    const k = 1 + Math.sin((i / lados) * Math.PI * 6 + fase) * irregular * 0.5 + (random() - 0.5) * irregular
    return [x + (px - x) * k, y + (py - y) * k]
  })
  fillShape(ctx, puntos, { seed, ...opciones })
}

/** Spiky splat: explosions, paint, impacts */
export function splat(ctx, x, y, r, { puntas = 9, interior = 0.5, seed = 1, ...opciones } = {}) {
  const random = rng(seed * 17 + 5)
  const puntos = []
  for (let i = 0; i < puntas * 2; i++) {
    const a = (i / (puntas * 2)) * Math.PI * 2 + (random() - 0.5) * 0.25
    const radio = (i % 2 ? r * interior : r) * (0.8 + random() * 0.35)
    puntos.push([x + Math.cos(a) * radio, y + Math.sin(a) * radio])
  }
  fillShape(ctx, puntos, { seed, ...opciones })
}

/**
 * An empty canvas, offscreen when the browser supports it. Textures for WebGL pass
 * `offscreen: false`: a regular canvas uploads the same everywhere (Safari included).
 */
export function lienzo(ancho, alto, { offscreen = true } = {}) {
  ancho = Math.ceil(ancho)
  alto = Math.ceil(alto)
  if (offscreen && typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(ancho, alto)
    return { c, g: c.getContext('2d') }
  }
  const c = document.createElement('canvas')
  c.width = ancho
  c.height = alto
  return { c, g: c.getContext('2d') }
}
