import { alturaEn, prepararPista } from './compartido/pista'
import { avanzarCarro, copiarCarro, crearCarro, rapidez } from './compartido/fisica'
import { crearCamara, seguir } from './compartido/camara'
import { crearEntrada, crearTeclado } from './entrada/teclado.js'
import { interpolarCarro } from './interpolar.js'
import { COLORES_CARRO } from './render/colores.js'
import { crearEscena3D } from './render3d/escena.js'
import { crearSonido } from './sonido.js'

/**
 * Single-player driving with no server (phase 1): the same physics the server will run,
 * at the same fixed 30 Hz, so what feels right here feels the same online.
 * Rendering runs at the screen's rate and blends between the last two ticks.
 */
export const TICK = 1 / 30

export function crearJuegoLocal(canvas, { circuito, params, color = COLORES_CARRO[0].color, alEstado, inicio = 0 }) {
  const pista = prepararPista(circuito)
  const escena = crearEscena3D(canvas, pista)
  const entrada = crearEntrada([crearTeclado(canvas)])
  const camara = crearCamara()
  // Same engine and tire sounds as online, to tune them here (unlocked on the first key)
  const sonido = crearSonido()
  escena.agregarCarro('yo', color)

  let carro = crearCarro(pista, inicio)
  let anterior = copiarCarro(carro)
  let acumulado = 0
  let ultimo = performance.now()
  let ultimoAviso = 0
  let cuadro = 0
  let acel = 0

  function tick() {
    anterior = copiarCarro(carro)
    const ctrl = entrada.leer()
    acel = ctrl.acel
    const golpe = avanzarCarro(carro, ctrl, params, pista, TICK)
    if (golpe > 5) sonido.efecto('muro', null, Math.min(1, golpe / 25))
    escena.registrarEfectos('yo', carro)
  }

  function dibujar(ahora) {
    cuadro = requestAnimationFrame(dibujar)
    // A hidden tab can come back after seconds: don't simulate all of it at once
    const dt = Math.min((ahora - ultimo) / 1000, 0.25)
    ultimo = ahora

    acumulado += dt
    while (acumulado >= TICK) {
      tick()
      acumulado -= TICK
    }
    const visible = interpolarCarro(anterior, carro, acumulado / TICK)
    seguir(camara, pista, { ...visible, altura: alturaEn(pista, visible.x, visible.y) }, dt)
    escena.dibujar([{ id: 'yo', estado: visible }], camara, dt)
    sonido.motor({
      velocidad: (carro.vx * Math.cos(carro.angulo) + carro.vy * Math.sin(carro.angulo)) / params.velocidadMax,
      acel,
      derrape: carro.derrape,
      tierra: carro.suelo === 'tierra',
    })

    if (alEstado && ahora - ultimoAviso > 100) {
      ultimoAviso = ahora
      alEstado({ kmh: Math.round(rapidez(carro) * 3.6), suelo: carro.suelo, derrape: carro.derrape })
    }
  }

  cuadro = requestAnimationFrame(dibujar)

  return {
    sonido,
    reiniciar() {
      carro = crearCarro(pista, inicio)
      anterior = copiarCarro(carro)
      camara.iniciada = false
      escena.limpiarEfectos()
    },
    destruir() {
      cancelAnimationFrame(cuadro)
      entrada.destruir()
      sonido.destruir()
      escena.destruir()
    },
  }
}
