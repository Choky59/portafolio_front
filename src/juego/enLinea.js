import { alturaEn, prepararPista } from './compartido/pista'
import { HITBOX, PARAMETROS_FISICA, avanzarCarro, colisionCarros, copiarCarro, rapidez } from './compartido/fisica'
import { PARAMETROS_CAMARA, PARAMETROS_CAMARA_PARTIDA, crearCamara, enVista, seguir } from './compartido/camara'
import { EVENTOS, FASES, FASES_CON_MANEJO, desempacarCarro } from './compartido/protocolo'
import { crearEntrada, crearTeclado } from './entrada/teclado.js'
import { interpolarCarro } from './interpolar.js'
import { colorCarro } from './render/colores.js'
import { crearEscena3D } from './render3d/escena.js'
import { crearSonido } from './sonido.js'
import ITEMS from './datos/items.json'

/**
 * Cliente del juego en línea. El servidor manda; aquí solo se dibuja y se predice.
 *
 * - Carro propio: PREDICCIÓN. Cada tick se leen los controles, se mandan al servidor y se
 *   aplican de inmediato con la misma física. El servidor aplica esos mismos controles en
 *   cuanto llegan (ver servidor/salas.ts), así que su estado coincide con lo predicho y casi
 *   nunca hay que corregir. Cuando sí (un choque con otro carro), se toma el estado del
 *   servidor, se vuelven a aplicar los controles que aún no conoce y la diferencia con lo que
 *   ya se mostraba se desvanece en unos cuadros, sin brincos.
 *   En las fases sin manejo (cuenta regresiva, pausa) o con el carro eliminado no se predice:
 *   el servidor tampoco mueve el carro.
 *
 * - Los demás carros: PROYECCIÓN AL PRESENTE. El `seq` de cada carro es su propio reloj (un
 *   control por tick de su dueño). Lo último recibido de cada uno se proyecta hacia adelante
 *   (su velocidad × lo que tardó en llegar + un ping) para verlo en el mismo instante que el
 *   carro propio predicho; si no, se vería metros atrás de donde está y los choques pasarían
 *   donde no se ven. El carro propio también choca contra ellos en la predicción.
 *
 * - La cámara compartida (en la partida) la calcula el servidor siguiendo al líder; aquí se
 *   interpola igual, con el reloj del servidor (`k`). Es la misma cámara con la que el servidor
 *   decide quién se salió de la imagen.
 */

const circuitos = Object.fromEntries(
  Object.values(import.meta.glob('./datos/circuitos/*.json', { eager: true, import: 'default' })).map((c) => [c.id, c]),
)

/** La cámara y los items sueltos se dibujan este tanto de ticks en el pasado (3 ticks a 30 Hz = 100 ms) */
const RETRASO_TICKS = 3
const MAX_HISTORIAL = 60
/** Si la predicción se equivocó por más que esto (un choque fuerte, reaparecer), se brinca sin suavizar */
const MAX_CORRECCION = 8
/** Diferencias menores son ruido de punto flotante entre navegadores: se ignoran */
const MIN_CORRECCION = 0.02
/** Hasta cuántos ticks hacia adelante se proyecta a los demás (8 ticks ≈ 270 ms) */
const MAX_EXTRAPOLAR = 8
const CADA_PING = 2000

/**
 * Una línea de tiempo con su propio reloj (`t`): guarda lo recibido y estima el desfase con el
 * reloj local, para dibujar siempre un poco en el pasado entre dos estados conocidos.
 */
function crearLineaDeTiempo() {
  return { historial: [], desfase: null }
}

function registrar(linea, t, valor, ahora) {
  const ultimo = linea.historial.at(-1)
  if (ultimo && t <= ultimo.t) return false
  linea.historial.push({ t, valor })
  if (linea.historial.length > MAX_HISTORIAL) linea.historial.shift()
  // Desfase suavizado; si cambió mucho (pausa larga, reaparecer) se reinicia
  const medido = t - ahora
  if (linea.desfase === null || Math.abs(medido - linea.desfase) > 30) linea.desfase = medido
  else linea.desfase += (medido - linea.desfase) * 0.05
  return true
}

/** El valor en el tiempo fraccionario `t`, interpolado con `mezclar(a, b, f)` */
function valorEn(linea, t, mezclar) {
  const h = linea.historial
  if (t >= h.at(-1).t) return h.at(-1).valor
  if (t <= h[0].t) return h[0].valor
  let b = 1
  while (h[b].t < t) b++
  const a = h[b - 1]
  return mezclar(a.valor, h[b].valor, (t - a.t) / (h[b].t - a.t))
}

function mezclarAngulo(a, b, f) {
  let d = b - a
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * f
}

function mezclarCamara(a, b, f) {
  if (!a || !b) return b
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    h: a.h + (b.h - a.h) * f,
    rumbo: mezclarAngulo(a.rumbo, b.rumbo, f),
    zoom: a.zoom + (b.zoom - a.zoom) * f,
    iniciada: true,
  }
}

/** The server's world at one tick: shared camera and loose items, blended between two ticks */
function mezclarMundo(a, b, f) {
  const entidades = b.entidades.map((eb) => {
    const ea = a.entidades.find((e) => e.id === eb.id)
    if (!ea) return eb
    return { ...eb, x: ea.x + (eb.x - ea.x) * f, y: ea.y + (eb.y - ea.y) * f, angulo: mezclarAngulo(ea.angulo, eb.angulo, f) }
  })
  return { cam: mezclarCamara(a.cam, b.cam, f), entidades }
}

export function crearJuegoEnLinea(canvas, { conexion, sala, miId, alEstado, alCambiarSala, alEvento, debug = false }) {
  const circuito = circuitos[sala.circuito]
  if (!circuito) throw new Error(`No tengo el circuito "${sala.circuito}" (npm run juego:sync)`)
  const pista = prepararPista(circuito)
  const tick = 1 / sala.tickHz
  const escena = crearEscena3D(canvas, pista, { items: ITEMS })
  const entrada = crearEntrada([crearTeclado(canvas)])
  const camaraPropia = crearCamara()
  // The click that created or joined the room counts as the gesture that unlocks audio
  const sonido = crearSonido()
  sonido.activar()
  /** Reloj local en ticks (continuo) */
  const relojLocal = () => performance.now() / 1000 / tick

  /* ------------------------------- Jugadores ------------------------------- */

  /** Los demás: id → { linea, visual (dónde se dibuja ahora) } */
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

  let fase = 'espera'
  let miVivo = true
  let miItem = -1
  const puedoManejar = () => FASES_CON_MANEJO.includes(fase) && miVivo

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
    // Marcas y polvo de los demás, desde donde se ven (al ritmo de la física)
    for (const [id, otro] of otros) if (otro.visual?.vivo) escena.registrarEfectos(id, otro.visual)
    if (!predicho || !puedoManejar()) return
    anterior = copiarCarro(predicho)
    avanzarCarro(predicho, ctrl, PARAMETROS_FISICA, pista, tick)
    // Choque predicho contra los demás donde se ven ahora: el golpe se siente al instante y el
    // servidor (que choca a todos de verdad) lo confirma; la diferencia se corrige suave
    for (const otro of otros.values()) {
      if (otro.visual?.vivo) colisionCarros(predicho, copiarCarro(otro.visual), PARAMETROS_FISICA)
    }
    escena.registrarEfectos(miId, predicho)
  }

  function reconciliar(servidor, confirmado) {
    while (pendientes.length && pendientes[0].seq <= confirmado) pendientes.shift()

    // Estado del servidor + los controles que todavía no conoce (si es que el carro se mueve)
    const nuevo = copiarCarro(servidor)
    if (puedoManejar()) for (const p of pendientes) avanzarCarro(nuevo, p.ctrl, PARAMETROS_FISICA, pista, tick)

    if (!predicho) {
      predicho = nuevo
      anterior = copiarCarro(nuevo)
      return
    }
    const dx = predicho.x - nuevo.x
    const dy = predicho.y - nuevo.y
    const da = diferenciaAngulo(predicho.angulo, nuevo.angulo)
    const error = Math.hypot(dx, dy)
    if (puedoManejar() && (error > MIN_CORRECCION || Math.abs(da) > 0.002)) {
      correcciones.push(performance.now())
      ultimaCorreccion = error
      if (debug) console.debug('[juego] corrección', { confirmado, pendientes: pendientes.map((p) => p.seq), error, da })
    }
    if (error > MAX_CORRECCION || !puedoManejar()) {
      // Reapareció en la parrilla o está quieto: sin suavizar
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

  /* ----------------------- Lo que manda el servidor ----------------------- */

  /** Lo que es del servidor y no de un carro (cámara compartida, items sueltos), con su reloj `k` */
  const mundo = crearLineaDeTiempo()
  let ultimaInstantanea = -1

  function recibir(inst) {
    // Una instantánea vieja deshacería controles ya confirmados (TCP no reordena, pero por si acaso)
    if (inst.k <= ultimaInstantanea) return
    ultimaInstantanea = inst.k
    fase = FASES[inst.f] ?? 'espera'
    const ahora = relojLocal()
    const cam = inst.cam
      ? { x: inst.cam[0], y: inst.cam[1], h: inst.cam[2], rumbo: inst.cam[3], zoom: inst.cam[4] ?? 1, iniciada: true }
      : null
    const entidades = inst.e.map(([id, item, x, y, angulo, vida]) => ({ id, item, x, y, angulo, vida }))
    registrar(mundo, inst.k, { cam, entidades }, ahora)
    escena.ponerCajas(new Set(inst.ci))
    for (const r of inst.c) {
      const { id, estado, seq: suSeq, vivo, item } = desempacarCarro(r)
      if (id === miId) {
        miVivo = vivo
        miItem = item
        reconciliar(estado, suSeq)
        continue
      }
      let otro = otros.get(id)
      if (!otro) otros.set(id, (otro = { linea: crearLineaDeTiempo(), visual: null }))
      // Un carro quieto (cuenta, pausa) manda el mismo seq: se actualiza su foto igual
      if (!registrar(otro.linea, suSeq, { ...estado, vivo }, ahora)) {
        const ultimo = otro.linea.historial.at(-1)
        ultimo.valor = { ...estado, vivo }
      }
    }
  }

  function recibirEvento(evento) {
    switch (evento.tipo) {
      case 'explosion':
        escena.explotar(evento.x, evento.y)
        sonido.efecto('explosion')
        break
      case 'golpe':
        escena.impacto(evento.x, evento.y, ITEMS[evento.item]?.color ?? '#ffffff')
        sonido.efecto('golpe')
        break
      case 'choque':
        escena.impacto(evento.x, evento.y, evento.descontrolados.length ? '#F4B33A' : '#F1E6CC')
        sonido.efecto(evento.descontrolados.length ? 'coletazo' : 'golpe')
        break
      case 'item':
        if (evento.id === miId) sonido.efecto('item')
        break
      case 'usar':
        sonido.efecto(ITEMS[evento.item]?.id === 'burro' ? 'rebuzno' : 'usar')
        break
      case 'punto':
        if (evento.id) sonido.efecto('punto')
        break
    }
    alEvento?.(evento)
  }

  /**
   * Dónde dibujar a otro carro. Lo último que llegó de él es de hace medio ping, y nuestro carro
   * (predicho) va medio ping adelante del servidor: para verlos en el mismo instante, lo último
   * recibido se proyecta un ping completo hacia adelante con su velocidad (con tope). Así lo que
   * ves es donde de verdad está y los choques pasan donde los ves. Cuando llega su posición real,
   * el dibujo se acerca a ella suave en vez de brincar.
   */
  function presenteDe(otro, local, pingTicks, dt) {
    const linea = otro.linea
    const ultimo = linea.historial.at(-1)
    const manejo = FASES_CON_MANEJO.includes(fase) && ultimo.valor.vivo
    // Ticks desde lo último que se recibió (según el reloj de ese carro) más el ping
    const adelante = manejo ? Math.max(0, Math.min(MAX_EXTRAPOLAR, local + linea.desfase - ultimo.t + pingTicks)) : 0
    const s = adelante * tick
    const objetivo = {
      ...ultimo.valor,
      x: ultimo.valor.x + ultimo.valor.vx * s,
      y: ultimo.valor.y + ultimo.valor.vy * s,
      angulo: ultimo.valor.angulo + ultimo.valor.w * s,
    }
    const antes = otro.visual
    if (!antes || !manejo || Math.hypot(objetivo.x - antes.x, objetivo.y - antes.y) > MAX_CORRECCION) {
      otro.visual = objetivo
    } else {
      const k = 1 - Math.exp(-18 * dt)
      otro.visual = {
        ...objetivo,
        x: antes.x + (objetivo.x - antes.x) * k,
        y: antes.y + (objetivo.y - antes.y) * k,
        angulo: antes.angulo + diferenciaAngulo(objetivo.angulo, antes.angulo) * k,
      }
    }
    return otro.visual
  }

  const dejar = [
    conexion.escuchar(EVENTOS.estado, recibir),
    conexion.escuchar(EVENTOS.sala, sincronizarSala),
    conexion.escuchar(EVENTOS.evento, recibirEvento),
  ]

  /* ---------------------------------- Ping --------------------------------- */

  let ping = null
  async function medir() {
    const ms = await conexion.medirPing(EVENTOS.ping)
    if (ms !== null) ping = ping === null ? ms : ping + (ms - ping) * 0.5
  }
  medir()
  const relojPing = setInterval(medir, CADA_PING)

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
    const pingTicks = (ping ?? 0) / 1000 / tick
    for (const [id, otro] of otros) {
      const linea = otro.linea
      if (!linea.historial.length) continue
      const visual = presenteDe(otro, local, pingTicks, dt)
      if (visual.vivo) estados.push({ id, estado: visual })
    }

    let mio = null
    if (predicho && miVivo) {
      mio = interpolarCarro(anterior, predicho, puedoManejar() ? acumulado / tick : 1)
      mio.x += correccion.x
      mio.y += correccion.y
      mio.angulo += correccion.angulo
      estados.push({ id: miId, estado: mio })
    }

    // Nadie se dibuja encimado: a los demás se les proyecta con su última velocidad, que no sabe
    // del choque que el servidor ya resolvió; hasta que llegue, se les separa en pantalla.
    // Al de otro se le saca del mío; entre dos ajenos, mitad y mitad. Solo visual.
    for (let i = 0; i < estados.length; i++) {
      for (let j = i + 1; j < estados.length; j++) {
        const a = estados[i]
        const b = estados[j]
        if (a.id === miId) separarEnPantalla(b.estado, a.estado, 1)
        else if (b.id === miId) separarEnPantalla(a.estado, b.estado, 1)
        else separarEnPantalla(a.estado, b.estado, 0.5)
      }
    }
    for (const { id, estado } of estados) if (id !== miId && otros.has(id)) otros.get(id).visual = estado

    // ?debug: what's on screen this frame, for testing tools
    if (debug) window.__juegoEstados = estados.map(({ id, estado }) => ({ id, x: estado.x, y: estado.y, angulo: estado.angulo }))

    // Cámara compartida e items sueltos del servidor, un poco en el pasado (suaves)
    const delServidor = mundo.historial.length ? valorEn(mundo, local + mundo.desfase - RETRASO_TICKS, mezclarMundo) : null
    escena.ponerEntidades(delServidor?.entidades ?? [])

    // En la partida, la cámara compartida del servidor; en la sala de espera, la propia
    let fueraDeVista = false
    if (delServidor?.cam) {
      escena.dibujar(estados, delServidor.cam, dt, PARAMETROS_CAMARA_PARTIDA)
      // ¿Me estoy saliendo de la imagen? Aviso para intentar el último recobro (la regla la decide el servidor)
      fueraDeVista = fase === 'carrera' && !!mio && !enVista(delServidor.cam, mio.x, mio.y, alturaEn(pista, mio.x, mio.y))
    } else {
      const seguido = mio ?? estados[0]?.estado
      if (seguido) seguir(camaraPropia, pista, { ...seguido, altura: alturaEn(pista, seguido.x, seguido.y) }, dt)
      escena.dibujar(estados, camaraPropia, dt, PARAMETROS_CAMARA)
    }

    if (predicho) {
      sonido.motor({
        velocidad: Math.min(1, rapidez(predicho) / PARAMETROS_FISICA.velocidadMax),
        derrape: predicho.derrape,
        tierra: predicho.suelo === 'tierra',
        activo: miVivo && fase !== 'resultados',
      })
    }

    if (alEstado && predicho && ahora - ultimoAviso > 100) {
      ultimoAviso = ahora
      while (correcciones.length && ahora - correcciones[0] > 1000) correcciones.shift()
      alEstado({
        kmh: miVivo ? Math.round(rapidez(predicho) * 3.6) : 0,
        suelo: predicho.suelo,
        derrape: miVivo ? predicho.derrape : 0,
        ping: ping === null ? null : Math.round(ping),
        correcciones: correcciones.length,
        ultimaCorreccion,
        vivo: miVivo,
        fuera: fueraDeVista,
        item: ITEMS[miItem] ?? null,
      })
    }
  }

  cuadro = requestAnimationFrame(dibujar)

  return {
    sonido,
    destruir() {
      cancelAnimationFrame(cuadro)
      clearInterval(relojPing)
      dejar.forEach((f) => f())
      entrada.destruir()
      sonido.destruir()
      escena.destruir()
    },
  }
}

/**
 * Saca a `mover` de encima de `fijo` (círculos de la caja de choque), moviéndolo `parte` de lo
 * que se enciman; el resto, si queda, se le mueve a `fijo` en sentido contrario.
 */
function separarEnPantalla(mover, fijo, parte) {
  const minimo = PARAMETROS_FISICA.radio * 2
  for (const oa of HITBOX) {
    for (const ob of HITBOX) {
      // Con la posición de este momento: los empujones anteriores ya la movieron
      const ax = mover.x + Math.cos(mover.angulo) * oa
      const ay = mover.y + Math.sin(mover.angulo) * oa
      const bx = fijo.x + Math.cos(fijo.angulo) * ob
      const by = fijo.y + Math.sin(fijo.angulo) * ob
      const d = Math.hypot(ax - bx, ay - by)
      if (d >= minimo || d === 0) continue
      const nx = (ax - bx) / d
      const ny = (ay - by) / d
      const encime = minimo - d
      mover.x += nx * encime * parte
      mover.y += ny * encime * parte
      fijo.x -= nx * encime * (1 - parte)
      fijo.y -= ny * encime * (1 - parte)
    }
  }
}

function diferenciaAngulo(a, b) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
