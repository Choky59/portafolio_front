import { rng } from '../piezas.js'

/**
 * Pencil-on-paper textures drawn on a 2D canvas: the paper floor, the sketchy
 * news circles and the hatched contact shadows. Everything is grayscale; the only
 * color in the scene is the people's emotion.
 */
export const PAPEL = '#fbfaf6'
export const GRAFITO = '#1c1c1c'

function lienzo(ancho, alto = ancho) {
  const c = document.createElement('canvas')
  c.width = ancho
  c.height = alto
  return { c, g: c.getContext('2d') }
}

/** Off-white paper with grain and a few faint stray strokes (tiles) */
export function texturaPapel(THREE) {
  const { c, g } = lienzo(256)
  const random = rng(21)
  g.fillStyle = PAPEL
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(0,0,0,${0.015 + random() * 0.03})`
    g.fillRect(random() * 256, random() * 256, 1, 1)
  }
  g.strokeStyle = 'rgba(0,0,0,0.035)'
  g.lineWidth = 1
  for (let i = 0; i < 14; i++) {
    const x = random() * 256
    const y = random() * 256
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + 10 + random() * 30, y - 6 - random() * 16)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * Hand-drawn circle: 3 slightly wobbly passes of the pencil plus very light
 * hatching inside. Transparent outside, to lay on the floor.
 */
export function texturaCirculo(THREE, seed = 1) {
  const T = 512
  const { c, g } = lienzo(T)
  const random = rng(seed)
  const centro = T / 2
  const radio = T / 2 - 10

  // Light diagonal hatching, clipped to the circle
  g.save()
  g.beginPath()
  g.arc(centro, centro, radio - 4, 0, Math.PI * 2)
  g.clip()
  g.strokeStyle = 'rgba(0,0,0,0.06)'
  g.lineWidth = 1.5
  for (let d = -T; d < T; d += 14) {
    g.beginPath()
    g.moveTo(d + random() * 3, T)
    g.lineTo(d + T + random() * 3, 0)
    g.stroke()
  }
  g.restore()

  // Pencil passes around the edge
  g.strokeStyle = GRAFITO
  g.lineCap = 'round'
  for (let pasada = 0; pasada < 3; pasada++) {
    g.globalAlpha = 0.45 + random() * 0.3
    g.lineWidth = 2 + random() * 2
    const inicio = random() * Math.PI * 2
    const fase = random() * 10
    g.beginPath()
    for (let a = 0; a <= Math.PI * 2.08; a += 0.04) {
      const r = radio - 3 + Math.sin(a * 3 + fase) * 3 + (random() - 0.5) * 1.5
      const x = centro + Math.cos(a + inicio) * r
      const y = centro + Math.sin(a + inicio) * r
      if (a === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Contact shadow as an ellipse of pencil hatching that fades at the edges */
export function texturaSombra(THREE) {
  const T = 128
  const { c, g } = lienzo(T)
  const random = rng(5)
  g.strokeStyle = GRAFITO
  g.lineWidth = 2
  for (let d = -T; d < T * 2; d += 7) {
    g.globalAlpha = 0.5 + random() * 0.3
    g.beginPath()
    g.moveTo(d, T)
    g.lineTo(d + T * 0.6, 0)
    g.stroke()
  }
  // Fade to transparent toward the edges
  g.globalAlpha = 1
  g.globalCompositeOperation = 'destination-in'
  const degradado = g.createRadialGradient(T / 2, T / 2, 0, T / 2, T / 2, T / 2)
  degradado.addColorStop(0, 'rgba(0,0,0,0.75)')
  degradado.addColorStop(0.55, 'rgba(0,0,0,0.45)')
  degradado.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = degradado
  g.fillRect(0, 0, T, T)
  return new THREE.CanvasTexture(c)
}

/** The user's destination marker: a red pencil circle with a cross, like a map pin drawn by hand */
export function texturaMarcador(THREE) {
  const T = 128
  const { c, g } = lienzo(T)
  const random = rng(9)
  const centro = T / 2
  g.strokeStyle = '#d8402b'
  g.lineCap = 'round'
  for (let pasada = 0; pasada < 2; pasada++) {
    g.lineWidth = 5 + random() * 2
    g.globalAlpha = 0.85
    const inicio = random() * Math.PI * 2
    g.beginPath()
    for (let a = 0; a <= Math.PI * 2.1; a += 0.08) {
      const r = 44 + (random() - 0.5) * 3
      const x = centro + Math.cos(a + inicio) * r
      const y = centro + Math.sin(a + inicio) * r
      if (a === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  g.lineWidth = 7
  g.beginPath()
  g.moveTo(centro - 16, centro - 16)
  g.lineTo(centro + 16, centro + 16)
  g.moveTo(centro + 16, centro - 16)
  g.lineTo(centro - 16, centro + 16)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
