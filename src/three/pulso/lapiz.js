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

/* ---------------------------------- Particles ---------------------------------- */

/**
 * Little drawings the emotions give off (particulas.js), in the same style as the
 * people: flat color, thick graphite outline. 128 px square, transparent around.
 * Confetti is white so each piece can be tinted (instance color).
 */
const DIBUJOS = {
  /** Anime anger vein: four curved strokes, each a red line over a thicker dark one */
  vena(g) {
    const arco = (rot) => {
      g.save()
      g.translate(64, 64)
      g.rotate(rot)
      g.beginPath()
      g.moveTo(-34, -12)
      g.quadraticCurveTo(-14, -14, -12, -34)
      g.restore()
    }
    for (const [ancho, color] of [[17, GRAFITO], [9, '#E4572E']]) {
      g.lineWidth = ancho
      g.strokeStyle = color
      for (let k = 0; k < 4; k++) {
        arco((k * Math.PI) / 2)
        g.stroke()
      }
    }
  },
  /** Puff of steam: three round blobs */
  vapor(g) {
    nube(g, [[44, 76, 22], [70, 62, 26], [88, 82, 18]], '#f4f4f2')
  },
  /** Four-point sparkle */
  destello(g) {
    g.beginPath()
    for (let k = 0; k < 8; k++) {
      const r = k % 2 ? 14 : 50
      const a = (k * Math.PI) / 4 - Math.PI / 2
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r)
    }
    g.closePath()
    rellenar(g, '#F6C445')
  },
  /** Eighth note */
  nota(g) {
    g.fillStyle = GRAFITO
    g.save()
    g.translate(48, 92)
    g.rotate(-0.4)
    g.beginPath()
    g.ellipse(0, 0, 18, 13, 0, 0, Math.PI * 2)
    g.fill()
    g.restore()
    g.lineCap = 'round'
    g.strokeStyle = GRAFITO
    g.lineWidth = 9
    g.beginPath()
    g.moveTo(63, 88)
    g.lineTo(63, 22)
    g.quadraticCurveTo(80, 40, 96, 44)
    g.stroke()
  },
  exclamacion(g) {
    signo(g, '!')
  },
  interrogacion(g) {
    signo(g, '?')
  },
  /** Drop: sweat (light) or tear (blue) */
  sudor(g) {
    gota(g, '#9fd8ff')
  },
  lagrima(g) {
    gota(g, '#4F8FE8')
  },
  /** Gray cloud with rain under it */
  nube(g) {
    g.lineCap = 'round'
    g.strokeStyle = '#4F8FE8'
    g.lineWidth = 6
    for (const [x, y] of [[40, 86], [62, 96], [84, 86], [52, 112], [76, 114]]) {
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x - 5, y + 12)
      g.stroke()
    }
    nube(g, [[38, 58, 20], [62, 46, 26], [88, 58, 20], [62, 66, 18]], '#c6c9cf')
  },
  /** A strip of paper; white so it can be tinted */
  confeti(g) {
    g.beginPath()
    g.rect(38, 50, 52, 28)
    rellenar(g, '#ffffff', 7)
  },
}

function rellenar(g, color, contorno = 9) {
  g.lineJoin = 'round'
  g.lineWidth = contorno
  g.strokeStyle = GRAFITO
  g.stroke()
  g.fillStyle = color
  g.fill()
}

function nube(g, circulos, color) {
  // Outline first (every blob a bit bigger), then the fill on top: one clean silhouette
  for (const [fondo, extra] of [[GRAFITO, 5], [color, 0]]) {
    g.fillStyle = fondo
    for (const [x, y, r] of circulos) {
      g.beginPath()
      g.arc(x, y, r + extra, 0, Math.PI * 2)
      g.fill()
    }
  }
}

function gota(g, color) {
  g.beginPath()
  g.moveTo(64, 16)
  g.bezierCurveTo(70, 40, 96, 62, 96, 82)
  g.arc(64, 82, 32, 0, Math.PI)
  g.bezierCurveTo(32, 62, 58, 40, 64, 16)
  rellenar(g, color)
  g.fillStyle = 'rgba(255,255,255,0.8)'
  g.beginPath()
  g.ellipse(54, 80, 6, 10, -0.4, 0, Math.PI * 2)
  g.fill()
}

function signo(g, texto) {
  g.font = '900 104px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = 16
  g.strokeStyle = '#ffffff'
  g.strokeText(texto, 64, 68)
  g.fillStyle = GRAFITO
  g.fillText(texto, 64, 68)
}

export const TIPOS_PARTICULA = Object.keys(DIBUJOS)

export function texturaParticula(THREE, tipo) {
  const { c, g } = lienzo(128)
  DIBUJOS[tipo](g)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
