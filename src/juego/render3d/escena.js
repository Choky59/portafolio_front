import * as THREE from 'three'
import { PARAMETROS_CAMARA, poseCamara } from '../compartido/camara'
import { alturaEn, cajasDelCircuito, rampaEn } from '../compartido/pista'
import { crearCarro3D, ponerCarro } from './carro.js'
import { crearEfectos3D } from './efectos.js'
import { crearCaja, crearModeloEntidad, crearPersona, materialCaja } from './entidades.js'
import { CATEGORIAS } from '../compartido/protocolo'
import { crearMundo } from './mundo.js'
import { brush, lienzo } from '../pincel.js'
import { COLORES } from '../render/colores.js'

const CIELO = '#F3E2BC'
/** Height of a name tag, as a fraction of the picture's height (it doesn't shrink with the zoom) */
const ALTO_NOMBRE = 0.06

/** A name tag: the name in brush letters on an ink pill, underlined with the car's color */
function crearNombre(nombre, color) {
  const alto = 72
  const medir = lienzo(8, 8, { offscreen: false }).g
  const fuente = '400 46px "Caveat Brush", "Comic Sans MS", cursive'
  medir.font = fuente
  const ancho = Math.ceil(Math.min(420, medir.measureText(nombre).width) + 44)
  const { c, g } = lienzo(ancho, alto, { offscreen: false })
  g.fillStyle = 'rgba(34, 23, 15, 0.78)'
  g.beginPath()
  g.roundRect(2, 2, ancho - 4, alto - 14, 26)
  g.fill()
  brush(g, [[18, alto - 8], [ancho - 18, alto - 8]], { color, ancho: 6, pasadas: 1, temblor: 1.2, seed: 3 })
  g.font = fuente
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = COLORES.crema
  g.fillText(nombre, ancho / 2, (alto - 12) / 2 + 3, ancho - 30)
  const textura = new THREE.CanvasTexture(c)
  textura.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: textura, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }),
  )
  sprite.center.set(0.5, 0)
  sprite.renderOrder = 10
  sprite.userData.aspecto = ancho / alto
  sprite.visible = false
  return sprite
}

/**
 * The game's 3D view. It knows nothing about rules or network: every frame it gets the cars'
 * states and a camera (compartido/camara.ts) and draws them. The camera pose comes from
 * poseCamara(), the same math the server uses to decide who's out of the picture.
 */
export function crearEscena3D(canvas, pista, { items = [] } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const escena = new THREE.Scene()
  escena.background = new THREE.Color(CIELO)
  escena.fog = new THREE.Fog(CIELO, 160, 480)

  const camara = new THREE.PerspectiveCamera(PARAMETROS_CAMARA.fov, 16 / 9, 0.5, 1000)

  // Warm afternoon sun from the west; its shadow box follows the camera
  escena.add(new THREE.HemisphereLight('#FFF4DC', '#B48A57', 1.5))
  const sol = new THREE.DirectionalLight('#FFE7BC', 2.2)
  sol.castShadow = true
  sol.shadow.mapSize.set(2048, 2048)
  // Big enough for the shared camera zoomed all the way out (ZOOM_MAX)
  Object.assign(sol.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 1, far: 360 })
  sol.shadow.bias = -0.0005
  sol.shadow.normalBias = 0.03
  escena.add(sol, sol.target)
  const DIRECCION_SOL = new THREE.Vector3(-50, 90, 40)

  const altura = (x, y) => alturaEn(pista, x, y)
  /** The ground for the cars: the terrain plus the ramps (up a ramp the car rides on it) */
  const sueloCarros = (x, y) => {
    const sobre = rampaEn(pista, x, y)
    return altura(x, y) + (sobre ? sobre.t * pista.circuito.rampas[sobre.indice].alto : 0)
  }
  const mundo = crearMundo(pista, renderer)
  escena.add(mundo)
  const efectos = crearEfectos3D(escena, altura)
  const carros = new Map()

  // Item boxes, spinning and bobbing over the road (hidden while switched off); the ones after a
  // ramp float up high (`z`), to be caught flying
  const cajas = cajasDelCircuito(pista.circuito).map(([x, y, z]) => {
    const caja = crearCaja()
    caja.position.set(x, altura(x, y) + 1.4 + z, y)
    caja.userData.z = z
    escena.add(caja)
    return caja
  })
  /** What's loose on the road: entity id → { modelo, item } */
  const entidades = new Map()
  /**
   * People that got run over, flying ragdoll style (only on screen): they tumble, bounce, end
   * up lying on the ground and after a while sink away. { modelo, v (velocity), giro, edad, quieto }
   */
  const voladores = []
  const GRAVEDAD = 22
  const VIDA_VOLADOR = 5

  /** Name tags over the cars (id → sprite) and how visible they are (0 … 1) */
  const nombres = new Map()
  let opacidadNombres = 0

  // The spectator's aim: a ring on the ground where the meteor would land
  const mira = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COLORES.crema, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
  )
  mira.visible = false
  escena.add(mira)
  const rayo = new THREE.Raycaster()
  const puntero = new THREE.Vector2()

  const arriba = new THREE.Vector3(0, 1, 0)
  const normal = new THREE.Vector3()
  const inclinacion = new THREE.Quaternion()
  const giro = new THREE.Quaternion()

  /**
   * Lays something flat on the ground (a pothole, a puddle, a speed bump), `tamano` meters
   * around its center: tilted with the slope measured at that distance, then lifted just enough
   * that no point around it is under the ground (hills curve, a flat piece doesn't).
   */
  function acostar(grupo, e, tamano) {
    const h = altura(e.x, e.y)
    const pendienteX = (altura(e.x + tamano, e.y) - altura(e.x - tamano, e.y)) / (2 * tamano)
    const pendienteZ = (altura(e.x, e.y + tamano) - altura(e.x, e.y - tamano)) / (2 * tamano)
    let hundido = 0
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      for (const d of [tamano * 0.5, tamano]) {
        const dx = Math.cos(a) * d
        const dz = Math.sin(a) * d
        hundido = Math.max(hundido, altura(e.x + dx, e.y + dz) - (h + pendienteX * dx + pendienteZ * dz))
      }
    }
    normal.set(-pendienteX, 1, -pendienteZ).normalize()
    inclinacion.setFromUnitVectors(arriba, normal)
    giro.setFromAxisAngle(arriba, -e.angulo)
    grupo.quaternion.copy(inclinacion).multiply(giro)
    grupo.position.set(e.x, h + hundido + 0.06, e.y)
  }

  function actualizarVoladores(dt, t) {
    for (let k = voladores.length - 1; k >= 0; k--) {
      const v = voladores[k]
      const g = v.modelo.grupo
      v.edad += dt
      if (v.edad > VIDA_VOLADOR) {
        escena.remove(g)
        g.traverse((o) => o.geometry?.dispose())
        voladores.splice(k, 1)
        continue
      }
      if (!v.quieto) {
        v.v.y -= GRAVEDAD * dt
        g.position.addScaledVector(v.v, dt)
        g.rotation.x += v.giro.x * dt
        g.rotation.y += v.giro.y * dt
        g.rotation.z += v.giro.z * dt
        v.modelo.agitar(t)
        const suelo = altura(g.position.x, g.position.z)
        if (g.position.y < suelo) {
          // Bounces, each time less, until it stays lying on the ground
          g.position.y = suelo
          v.v.y = -v.v.y * 0.35
          v.v.x *= 0.55
          v.v.z *= 0.55
          v.giro.multiplyScalar(0.5)
          if (v.v.length() < 2) {
            v.quieto = true
            g.rotation.set(0, g.rotation.y, Math.PI / 2)
            g.position.y = suelo + 0.25
          }
        }
      } else if (v.edad > VIDA_VOLADOR - 0.6) {
        // Sinks into the ground and it's gone
        g.position.y -= dt * 1.2
      }
    }
  }

  function ajustarTamano() {
    const ancho = canvas.clientWidth
    const alto = canvas.clientHeight
    if (!ancho || !alto) return
    const actual = renderer.getSize(new THREE.Vector2())
    if (actual.x !== ancho || actual.y !== alto) {
      renderer.setSize(ancho, alto, false)
      camara.aspect = ancho / alto
      camara.updateProjectionMatrix()
    }
  }

  return {
    agregarCarro(id, color, nombre) {
      const carro = crearCarro3D(color)
      carros.set(id, carro)
      escena.add(carro.grupo)
      if (nombre) {
        const etiqueta = crearNombre(nombre, color)
        nombres.set(id, etiqueta)
        escena.add(etiqueta)
      }
    },

    quitarCarro(id) {
      const carro = carros.get(id)
      if (carro) escena.remove(carro.grupo)
      carros.delete(id)
      const etiqueta = nombres.get(id)
      if (etiqueta) {
        escena.remove(etiqueta)
        etiqueta.material.map.dispose()
        etiqueta.material.dispose()
      }
      nombres.delete(id)
      efectos.olvidar(id)
    },

    /** How visible the name tags over the cars are (0 hides them) */
    ponerNombres(opacidad) {
      opacidadNombres = opacidad
    },

    /**
     * The point of the ground under the pointer, from its position in the picture (-1 … 1 on
     * each axis, y up), as { x, y } in physics coordinates; null if it isn't over the ground
     */
    sueloEn(nx, ny) {
      puntero.set(nx, ny)
      rayo.setFromCamera(puntero, camara)
      const golpe = rayo.intersectObject(mundo.userData.suelo, false)[0]
      return golpe ? { x: golpe.point.x, y: golpe.point.z } : null
    },

    /** The spectator's aim at (x, y), or hidden with null. `listo`: a meteor can go now */
    ponerMira(punto, listo) {
      mira.visible = !!punto
      if (!punto) return
      mira.position.set(punto.x, altura(punto.x, punto.y) + 0.15, punto.y)
      mira.material.color.set(listo ? '#E4572E' : '#9A8B78')
      mira.material.opacity = listo ? 0.95 : 0.6
    },

    /** Once per physics tick: tire marks and dust come from the simulated states */
    registrarEfectos(id, estado) {
      efectos.registrar(id, estado)
    },

    /** A car is out of the round: explosion, or a splash if it went into the water */
    explotar(x, y, motivo) {
      if (motivo === 'agua') efectos.chapuzon(x, y)
      else efectos.explosion(x, y)
    },

    impacto(x, y, color) {
      efectos.impacto(x, y, color)
    },

    /** A car ran over a person (the entity `id`) at (x, y), going at (vx, vy): off it flies */
    atropellar({ id, x, y, vx, vy }) {
      const modelo = crearPersona(id)
      const rapidez = Math.hypot(vx, vy)
      modelo.grupo.position.set(x, altura(x, y), y)
      modelo.grupo.rotation.y = -Math.atan2(vy, vx)
      escena.add(modelo.grupo)
      voladores.push({
        modelo,
        v: new THREE.Vector3(vx * 0.75 + (Math.random() - 0.5) * 4, 7 + rapidez * 0.25, vy * 0.75 + (Math.random() - 0.5) * 4),
        giro: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14),
        edad: 0,
        quieto: false,
      })
      efectos.impacto(x, y, '#F1E6CC')
    },

    /** Boxes switched off (indices) and, from the server, each one's color (category index) */
    ponerCajas(apagadas, categorias) {
      cajas.forEach((caja, i) => {
        caja.visible = !apagadas.has(i)
        if (categorias?.[i] !== undefined) caja.material = materialCaja(CATEGORIAS[categorias[i]]?.color)
      })
    },

    /** Loose items: [{ id, item, x, y, angulo, vida, etapa }] (already interpolated) */
    ponerEntidades(lista) {
      const vistas = new Set()
      const t = performance.now() / 1000
      for (const e of lista) {
        vistas.add(e.id)
        let actual = entidades.get(e.id)
        if (!actual) {
          const item = items[e.item]
          if (!item) continue
          actual = crearModeloEntidad(item, e.id)
          entidades.set(e.id, actual)
          escena.add(actual.grupo)
        }
        if (actual.sobreSuelo) acostar(actual.grupo, e, actual.sobreSuelo)
        else {
          actual.grupo.position.set(e.x, altura(e.x, e.y), e.y)
          actual.grupo.rotation.y = -e.angulo
        }
        actual.animar?.(t, e.vida, e.etapa ?? 0)
      }
      for (const [id, actual] of entidades) {
        if (vistas.has(id)) continue
        escena.remove(actual.grupo)
        entidades.delete(id)
      }
    },

    limpiarEfectos() {
      efectos.limpiar()
    },

    /**
     * Draws a frame. `estados` = [{ id, estado }] (already interpolated); cars not listed are
     * hidden (out of the round). `cam` = a camera from compartido/camara.ts, `p` its parameters.
     */
    dibujar(estados, cam, dt, p = PARAMETROS_CAMARA) {
      ajustarTamano()
      for (const carro of carros.values()) carro.grupo.visible = false
      for (const etiqueta of nombres.values()) etiqueta.visible = false
      // Name tags keep the same size on screen whatever the zoom: with sizeAttenuation off, a
      // sprite of scale s covers s / tan(fov / 2) of the picture's height in clip space (which is 2 tall)
      const altoNombre = 2 * ALTO_NOMBRE * Math.tan(((p.fov / 2) * Math.PI) / 180)
      for (const { id, estado } of estados) {
        const carro = carros.get(id)
        if (!carro) continue
        carro.grupo.visible = true
        ponerCarro(carro, estado, sueloCarros)
        const etiqueta = nombres.get(id)
        if (etiqueta && opacidadNombres > 0) {
          etiqueta.visible = true
          etiqueta.material.opacity = opacidadNombres
          // Rises a little as it fades out
          etiqueta.position.set(estado.x, altura(estado.x, estado.y) + 3.2 + (1 - opacidadNombres) * 1.5, estado.y)
          etiqueta.scale.set(altoNombre * etiqueta.userData.aspecto, altoNombre, 1)
        }
      }
      efectos.actualizar(dt)
      const t = performance.now() / 1000
      actualizarVoladores(dt, t)
      cajas.forEach((caja, i) => {
        caja.rotation.set(0.4, t * 1.6 + i, 0.3)
        caja.position.y = altura(caja.position.x, caja.position.z) + 1.4 + caja.userData.z + Math.sin(t * 3 + i) * 0.25
      })

      if (camara.fov !== p.fov) {
        camara.fov = p.fov
        camara.updateProjectionMatrix()
      }
      const { posicion, mira } = poseCamara(cam, p)
      camara.position.set(...posicion)
      camara.lookAt(...mira)

      sol.target.position.set(...mira)
      sol.position.set(...mira).add(DIRECCION_SOL)

      renderer.render(escena, camara)
    },

    destruir() {
      escena.traverse((o) => {
        o.geometry?.dispose()
        const materiales = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
        for (const m of materiales) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose()
          m.dispose()
        }
      })
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
