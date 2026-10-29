import { prepararPista } from './compartido/pista'
import { PARAMETROS_FISICA, avanzarCarro, copiarCarro, rapidez } from './compartido/fisica'
import { crearCamara, seguir } from './compartido/camara'
import { EVENTOS, desempacarCarro } from './compartido/protocolo'
import { crearEntrada, crearTeclado } from './entrada/teclado.js'
import { interpolarCarro } from './interpolar.js'
import { colorCarro } from './render/colores.js'
import { crearEscena3D } from './render3d/escena.js'

/**
 * Cliente del juego en línea. El servidor manda; aquí solo se dibuja y se predice.
 *
 * - Carro propio: PREDICCIÓN. Cada tick se leen los controles, se mandan al servidor y se
 *   aplican de inmediato con la misma física. El servidor aplica esos mismos controles en
 *   cuanto llegan (ver servidor/salas.ts), así que su estado coincide con lo predicho y casi
 *   nunca hay que corregir. Cuando sí (un choque con otro carro), se toma el estado del
 *   servidor, se vuelven a aplicar los controles que aún no conoce y la diferencia con lo que
 *   ya se mostraba se desvanece en unos cuadros, sin brincos.
 *
 * - Los demás carros: INTERPOLACIÓN POR CARRO. El `seq` de cada carro es su propio reloj (un
 *   control por tick de su dueño). Por carro se estima el desfase entre su `seq` y el reloj
 *   local y se dibuja RETRASO_TICKS antes de lo último recibido, entre dos estados conocidos.
 *   Las ráfagas y los huecos de la red quedan absorbidos por ese colchón.
 */

const circuitos = Object.fromEntries(
  Object.values(import.meta.glob('./datos/circuitos/*.json', { eager: true, import: 'default' })).map((c) => [c.id, c]),
)

/** Los demás se dibujan este tanto de ticks en el pasado (3 ticks a 30 Hz = 100 ms) */
const RETRASO_TICKS = 3
const MAX_HISTORIAL = 60
/** Si la predicción se equivocó por más que esto (un choque fuerte), se brinca sin suavizar */
const MAX_CORRECCION = 8
/** Diferencias menores son ruido de punto flotante entre navegadores: se ignoran */
const MIN_CORRECCION = 0.02
const CADA_PING = 2000

export function crearJuegoEnLinea(canvas, { conexion, sala, miId, alEstado, alCambiarSala, debug = false }) {
  const circuito = circuitos[sala.circuito]
  if (!circuito) throw new Error(`No tengo el circuito "${sala.circuito}" (npm run juego:sync)`)
  const pista = prepararPista(circuito)
  const tick = 1 / sala.tickHz
  const escena = crearEscena3D(canvas, pista)
  const entrada = crearEntrada([crearTeclado(canvas)])
  const camara = crearCamara()
  /** Reloj local en ticks (continuo) */
  const relojLocal = () => performance.now() / 1000 / tick

  /* ------------------------------- Jugadores ------------------------------- */

  /** Los demás: id → { historial: [{ seq, estado }], desfase, ultimoEfecto } */
  const otros = new Map()
  const enEscena = new Set()

  function sincronizarSala(nueva) {
    const ids = new Set(nueva.jugadores.map((j) => j.id))
    for (const j of nueva.jugadores) {
      if (enEscena.has(j.id)) continue
      escena.agregarCarro(j.id, colorCarro(j.color))
      enEscena.add(j.id)
    }
    for (const id of [...enEscena]) {
      if (ids.has(id)) continue
      escena.quitarCarro(id) // se desconectó: su carro desaparece
      enEscena.delete(id)
      otros.delete(id)
    }
    alCambiarSala?.(nueva)
  }
  sincronizarSala(sala)

  /* -------------------------- Predicción propia --------------------------- */

  let predicho = null
  let anterior = null
  let seq = 0
  /** Controles enviados que el servidor aún no confirma: { seq, ctrl } */
  const pendientes = []
  const correccion = { x: 0, y: 0, angulo: 0 }
  /** Para ?debug: cuándo hubo correcciones y de qué tamaño fue la última */
  const correcciones = []
  let ultimaCorreccion = 0

  function pasoLocal() {
    const ctrl = entrada.leer()
    seq++
    conexion.emitir(EVENTOS.controles, { seq, ...ctrl })
    pendientes.push({ seq, ctrl })
    if (pendientes.length > 120) pendientes.shift() // el servidor dejó de contestar
    if (!predicho) return
    anterior = copiarCarro(predicho)
    avanzarCarro(predicho, ctrl, PARAMETROS_FISICA, pista, tick)
    escena.registrarEfectos(miId, predicho)
  }

  function reconciliar(servidor, confirmado) {
    while (pendientes.length && pendientes[0].seq <= confirmado) pendientes.shift()

    // Estado del servidor + los controles que todavía no conoce
    const nuevo = copiarCarro(servidor)
    for (const p of pendientes) avanzarCarro(nuevo, p.ctrl, PARAMETROS_FISICA, pista, tick)

    if (!predicho) {
      predicho = nuevo
      anterior = copiarCarro(nuevo)
      return
    }
    const dx = predicho.x - nuevo.x
    const dy = predicho.y - nuevo.y
    const da = diferenciaAngulo(predicho.angulo, nuevo.angulo)
    const error = Math.hypot(dx, dy)
    if (error > MIN_CORRECCION || Math.abs(da) > 0.002) {
      correcciones.push(performance.now())
      ultimaCorreccion = error
      if (debug) console.debug('[juego] corrección', { confirmado, pendientes: pendientes.map((p) => p.seq), error, da })
    }
    if (error > MAX_CORRECCION) {
      correccion.x = correccion.y = correccion.angulo = 0
      anterior = copiarCarro(nuevo)
    } else {
      // Lo que se ve no cambia en este cuadro: el error pasa a la corrección, que se desvanece
      correccion.x += dx
      correccion.y += dy
      correccion.angulo += da
      anterior.x -= dx
      anterior.y -= dy
      anterior.angulo -= da
    }
    predicho = nuevo
  }

  /* ------------------------- Interpolación ajena --------------------------- */

  let ultimaInstantanea = -1

  function recibir(inst) {
    // Una instantánea vieja deshacería controles ya confirmados (TCP no reordena, pero por si acaso)
    if (inst.k <= ultimaInstantanea) return
    ultimaInstantanea = inst.k
    const ahora = relojLocal()
    for (const r of inst.c) {
      const { id, estado, seq: suSeq } = desempacarCarro(r)
      if (id === miId) {
        reconciliar(estado, suSeq)
        continue
      }
      let otro = otros.get(id)
      if (!otro) otros.set(id, (otro = { historial: [], desfase: null, ultimoEfecto: suSeq }))
      const ultimo = otro.historial.at(-1)
      if (ultimo && suSeq <= ultimo.seq) continue // no se ha movido: misma foto
      otro.historial.push({ seq: suSeq, estado })
      if (otro.historial.length > MAX_HISTORIAL) otro.historial.shift()
      // Desfase entre su reloj (seq) y el nuestro, suavizado; si cambió mucho (pausa larga), se reinicia
      const medido = suSeq - ahora
      if (otro.desfase === null || Math.abs(medido - otro.desfase) > 30) otro.desfase = medido
      else otro.desfase += (medido - otro.desfase) * 0.05
    }
  }

  /** Estado de otro carro en su `seq` fraccionario, entre los dos estados que lo rodean */
  function estadoEn(historial, s) {
    if (s >= historial.at(-1).seq) return historial.at(-1).estado
    if (s <= historial[0].seq) return historial[0].estado
    let b = 1
    while (historial[b].seq < s) b++
    const a = historial[b - 1]
    const c = historial[b]
    return interpolarCarro(a.estado, c.estado, (s - a.seq) / (c.seq - a.seq))
  }

  const dejarEstado = conexion.escuchar(EVENTOS.estado, recibir)
  const dejarSala = conexion.escuchar(EVENTOS.sala, sincronizarSala)

  /* ---------------------------------- Ping --------------------------------- */

  let ping = null
  async function medir() {
    const ms = await conexion.medirPing(EVENTOS.ping)
    if (ms !== null) ping = ping === null ? ms : ping + (ms - ping) * 0.5
  }
  medir()
  const reloj = setInterval(medir, CADA_PING)

  /* --------------------------------- Bucle --------------------------------- */

  let acumulado = 0
  let ultimo = performance.now()
  let ultimoAviso = 0
  let cuadro = 0

  function dibujar(ahora) {
    cuadro = requestAnimationFrame(dibujar)
    const dt = Math.min((ahora - ultimo) / 1000, 0.25)
    ultimo = ahora

    acumulado += dt
    while (acumulado >= tick) {
      pasoLocal()
      acumulado -= tick
    }
    const desvanecer = Math.exp(-10 * dt)
    correccion.x *= desvanecer
    correccion.y *= desvanecer
    correccion.angulo *= desvanecer

    const estados = []
    const local = relojLocal()
    for (const [id, otro] of otros) {
      if (!otro.historial.length) continue
      const s = local + otro.desfase - RETRASO_TICKS
      estados.push({ id, estado: estadoEn(otro.historial, s) })
      // Marcas y polvo, conforme su dibujo pasa por cada estado recibido
      for (const h of otro.historial) {
        if (h.seq <= otro.ultimoEfecto || h.seq > s) continue
        escena.registrarEfectos(id, h.estado)
        otro.ultimoEfecto = h.seq
      }
    }

    let mio = null
    if (predicho) {
      mio = interpolarCarro(anterior, predicho, acumulado / tick)
      mio.x += correccion.x
      mio.y += correccion.y
      mio.angulo += correccion.angulo
      estados.push({ id: miId, estado: mio })
    }

    const seguido = mio ?? estados[0]?.estado
    if (seguido) seguir(camara, pista, seguido, dt)
    escena.dibujar(estados, camara, dt)

    if (alEstado && predicho && ahora - ultimoAviso > 100) {
      ultimoAviso = ahora
      while (correcciones.length && ahora - correcciones[0] > 1000) correcciones.shift()
      alEstado({
        kmh: Math.round(rapidez(predicho) * 3.6),
        suelo: predicho.suelo,
        derrape: predicho.derrape,
        ping: ping === null ? null : Math.round(ping),
        correcciones: correcciones.length,
        ultimaCorreccion,
      })
    }
  }

  cuadro = requestAnimationFrame(dibujar)

  return {
    destruir() {
      cancelAnimationFrame(cuadro)
      clearInterval(reloj)
      dejarEstado()
      dejarSala()
      entrada.destruir()
      escena.destruir()
    },
  }
}

function diferenciaAngulo(a, b) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
