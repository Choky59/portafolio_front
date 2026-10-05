/**
 * Low-poly building blocks shared by the scenes: saguaro, sun, thermometer, ground.
 * Flat shading gives the hand-made, faceted look of the brand.
 */

/** Deterministic random, so every visit draws the same landscape */
export function rng(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function material(THREE, color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.85,
    metalness: 0,
    ...extra,
  })
}

export function luces(THREE, scene, paleta) {
  const hemi = new THREE.HemisphereLight(paleta.text, paleta.suelo, 1.4)
  const sol = new THREE.DirectionalLight(paleta.accent, 2.2)
  sol.position.set(4, 8, 5)
  scene.add(hemi, sol)
  return { hemi, sol }
}

export function crearSaguaro(THREE, color, random = Math.random) {
  const grupo = new THREE.Group()
  const mat = material(THREE, color)

  const tronco = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 2.2, 3, 7), mat)
  tronco.position.y = 1.4
  grupo.add(tronco)

  function brazo(lado, altura, largo) {
    const codo = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.35, 3, 6), mat)
    codo.rotation.z = Math.PI / 2
    codo.position.set(lado * 0.45, altura, 0)

    const vertical = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, largo, 3, 6), mat)
    vertical.position.set(lado * 0.72, altura + largo / 2 + 0.05, 0)

    grupo.add(codo, vertical)
  }

  brazo(-1, 1.1 + random() * 0.4, 0.6 + random() * 0.4)
  brazo(1, 1.5 + random() * 0.4, 0.5 + random() * 0.4)

  return grupo
}

export function crearSol(THREE, color) {
  const grupo = new THREE.Group()

  const nucleo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color })
  )

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.25, 1.42, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  )

  grupo.add(nucleo, halo)
  return { grupo, nucleo, halo }
}

/**
 * Thermometer with its base (bulb center) at y = 0.
 * setNivel(0..1) fills the tube, setColor(css) tints the liquid.
 */
export function crearTermometro(THREE, paleta) {
  const grupo = new THREE.Group()
  const alturaTubo = 3

  const vidrio = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.26, alturaTubo, 4, 12),
    new THREE.MeshStandardMaterial({
      color: paleta.vidrio,
      transparent: true,
      opacity: 0.28,
      roughness: 0.15,
      depthWrite: false,
    })
  )
  vidrio.position.y = alturaTubo / 2 + 0.3

  const liquidoMat = material(THREE, paleta.calor, { roughness: 0.4 })

  const bulbo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), liquidoMat)

  // Geometry translated so scale.y grows from the bottom
  const columnaGeo = new THREE.CylinderGeometry(0.13, 0.13, 1, 8)
  columnaGeo.translate(0, 0.5, 0)
  const columna = new THREE.Mesh(columnaGeo, liquidoMat)
  columna.position.y = 0.3

  const marcaMat = material(THREE, paleta.text)
  for (let i = 0; i <= 6; i++) {
    const marca = new THREE.Mesh(new THREE.BoxGeometry(i % 3 === 0 ? 0.22 : 0.13, 0.025, 0.025), marcaMat)
    marca.position.set(0.3, 0.5 + (i / 6) * (alturaTubo - 0.4), 0)
    grupo.add(marca)
  }

  grupo.add(vidrio, bulbo, columna)

  const maxColumna = alturaTubo - 0.1

  return {
    grupo,
    setNivel(nivel) {
      columna.scale.y = Math.max(0.02, Math.min(1, nivel)) * maxColumna
    },
    setColor(color) {
      liquidoMat.color.set(color)
    },
  }
}

/** Faceted desert floor */
export function crearSuelo(THREE, color, { ancho = 40, fondo = 24, seed = 7 } = {}) {
  const random = rng(seed)
  const geo = new THREE.PlaneGeometry(ancho, fondo, 24, 14)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, (random() - 0.5) * 0.35)
  }
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material(THREE, color))
}

export function crearMontanas(THREE, color, { seed = 3, cantidad = 7, z = -12 } = {}) {
  const random = rng(seed)
  const grupo = new THREE.Group()
  const mat = material(THREE, color)
  for (let i = 0; i < cantidad; i++) {
    const alto = 2.5 + random() * 3.5
    const cono = new THREE.Mesh(new THREE.ConeGeometry(2.5 + random() * 2, alto, 5 + Math.floor(random() * 3)), mat)
    cono.position.set(-16 + i * (32 / (cantidad - 1)) + (random() - 0.5) * 2, alto / 2 - 0.2, z - random() * 3)
    cono.rotation.y = random() * Math.PI
    grupo.add(cono)
  }
  return grupo
}

/** Smooth approach for animations: moves `actual` toward `objetivo` */
export function acercar(actual, objetivo, dt, velocidad = 4) {
  return actual + (objetivo - actual) * (1 - Math.exp(-velocidad * dt))
}
