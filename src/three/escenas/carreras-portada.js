import { acercar, rng } from '../piezas.js'
import { blob, brush, lienzo } from '../../juego/pincel.js'
import { COLORES } from '../../juego/render/colores.js'
import { crearCarro3D, ponerCarro } from '../../juego/render3d/carro.js'
import { DECORACION } from '../../juego/render3d/decoracion.js'
import { crearEfectos3D } from '../../juego/render3d/efectos.js'

/**
 * Cover of Proyecto #3: a little car drifting around a roundabout in front of the
 * Cerro de la Campana, with the game's own pieces (car, tire marks, smoke, props) and a
 * brush-painted ground. Scene contract: see three/stage.js.
 */
const RADIO = 12
const VUELTA = 0.85 // rad/s around the roundabout

/** Sand disc with a roundabout road, painted with the brush engine, fading at the edges */
function texturaSuelo(THREE) {
  const T = 512
  const M = 60 // meters across
  const { c, g } = lienzo(T, T, { offscreen: false })
  g.setTransform(T / M, 0, 0, T / M, T / 2, T / 2)
  const random = rng(8)
  g.fillStyle = COLORES.arena
  g.fillRect(-M / 2, -M / 2, M, M)
  for (let i = 0; i < 14; i++) {
    blob(g, (random() - 0.5) * M, (random() - 0.5) * M, 2 + random() * 4, { relleno: COLORES.arenaOscura, contorno: null, irregular: 0.5, seed: i + 1 })
  }
  const anillo = (r) => Array.from({ length: 64 }, (_, i) => [Math.cos((i / 64) * Math.PI * 2) * r, Math.sin((i / 64) * Math.PI * 2) * r])
  g.lineWidth = 7.6
  g.strokeStyle = COLORES.orilla
  g.beginPath()
  g.arc(0, 0, RADIO, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 6.4
  g.strokeStyle = COLORES.asfalto
  g.stroke()
  brush(g, anillo(RADIO + 3.6), { ancho: 0.25, temblor: 0.1, cerrado: true, seed: 2 })
  brush(g, anillo(RADIO - 3.6), { ancho: 0.25, temblor: 0.1, cerrado: true, seed: 3 })
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    brush(g, [[Math.cos(a) * RADIO, Math.sin(a) * RADIO], [Math.cos(a + 0.12) * RADIO, Math.sin(a + 0.12) * RADIO]], {
      color: COLORES.linea,
      ancho: 0.3,
      pasadas: 1,
      seed: i + 4,
    })
  }
  // Soft round edge
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalCompositeOperation = 'destination-in'
  const borde = g.createRadialGradient(T / 2, T / 2, T * 0.3, T / 2, T / 2, T / 2)
  borde.addColorStop(0, 'rgba(0,0,0,1)')
  borde.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = borde
  g.fillRect(0, 0, T, T)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return { textura: t, metros: M }
}

export default function crearPortadaCarreras() {
  let mundo
  let carro
  let efectos
  let inclinacion = 0
  let ultimoEfecto = 0

  /** The car drifting around the roundabout at time t: nose pointing inside the turn */
  function estadoEn(t) {
    const a = t * VUELTA
    const x = Math.cos(a) * RADIO
    const y = Math.sin(a) * RADIO
    const avance = a + Math.PI / 2
    const v = VUELTA * RADIO
    return {
      x,
      y,
      angulo: avance + 0.55,
      vx: Math.cos(avance) * v,
      vy: Math.sin(avance) * v,
      w: VUELTA,
      derrape: 1,
      suelo: 'asfalto',
      aturdido: 0,
      turbo: 0,
    }
  }

  return {
    tiempoEstatico: 3.2,

    setup(ctx) {
      const { THREE, scene, camera, renderer } = ctx
      renderer.shadowMap.enabled = true
      mundo = new THREE.Group()
      scene.add(mundo)

      scene.add(new THREE.HemisphereLight('#FFF4DC', '#B48A57', 1.6))
      const sol = new THREE.DirectionalLight('#FFE7BC', 2.2)
      sol.position.set(-14, 24, 12)
      sol.castShadow = true
      sol.shadow.mapSize.set(1024, 1024)
      Object.assign(sol.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 })
      scene.add(sol)

      const { textura, metros } = texturaSuelo(THREE)
      const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(metros, metros).rotateX(-Math.PI / 2),
        new THREE.MeshLambertMaterial({ map: textura, transparent: true }),
      )
      suelo.receiveShadow = true
      mundo.add(suelo)

      // Cerro de la Campana: a faceted hill with its antennas, behind the roundabout
      const cerro = new THREE.Mesh(new THREE.ConeGeometry(17, 13, 7), new THREE.MeshLambertMaterial({ color: '#C29A6B', flatShading: true }))
      cerro.position.set(2, 6.2, -30)
      cerro.scale.set(1.6, 1, 0.8)
      mundo.add(cerro)
      for (const [x, escala] of [[0, 0.45], [4, 0.35], [-3.5, 0.3]]) {
        const antena = DECORACION.antena(escala)
        antena.position.set(x + 2, 12.4, -30)
        mundo.add(antena)
      }
      const random = rng(12)
      for (const [x, z] of [[-17, -6], [16, -4], [-12, 9], [19, 10], [-21, 2]]) {
        const saguaro = DECORACION.saguaro(0.5 + random() * 0.3, random)
        saguaro.position.set(x, 0, z)
        mundo.add(saguaro)
      }
      const puesto = DECORACION['puesto-dogos'](1)
      puesto.position.set(0, 0, 0)
      puesto.rotation.y = 0.6
      mundo.add(puesto)

      carro = crearCarro3D('#E4572E')
      mundo.add(carro.grupo)
      // With reduced motion there's a single frame at tiempoEstatico: update() lays down every
      // tire mark up to then, so the still image already shows the drift
      efectos = crearEfectos3D(mundo)

      camera.position.set(0, 17, 31)
      camera.lookAt(0, 1, -4)
    },

    update(dt, t, input) {
      const estado = estadoEn(t)
      ponerCarro(carro, estado)
      // Tire marks and smoke at a steady 30 Hz, like the game
      while (ultimoEfecto < t) {
        efectos.registrar('carro', estadoEn(ultimoEfecto))
        ultimoEfecto += 1 / 30
      }
      efectos.actualizar(dt)
      inclinacion = acercar(inclinacion, input.x * 0.25, dt || 1, 3)
      mundo.rotation.y = inclinacion
    },
  }
}
