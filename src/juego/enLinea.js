import { alturaEn, prepararPista } from './compartido/pista'
import { HITBOX, PARAMETROS_FISICA, avanzarCarro, colisionFija, copiarCarro, enElAire, rapidez } from './compartido/fisica'
import { PARAMETROS_CAMARA, PARAMETROS_CAMARA_PARTIDA, crearCamara, enVista, seguir } from './compartido/camara'
import { EVENTOS, FASES, FASES_CON_MANEJO, desempacarCarro } from './compartido/protocolo'
import { crearEntrada, crearTeclado } from './entrada/teclado.js'
import { interpolarCarro } from './interpolar.js'
import { colorCarro } from './render/colores.js'
import { crearEscena3D } from './render3d/escena.js'
import { SONIDO_USAR, crearSonido } from './sonido.js'
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
 * - Los demás carros: INTERPOLACIÓN CERCANA. El `seq` de cada carro es su propio reloj (un
 *   control por tick de su dueño). Se dibujan RETRASO_OTROS ticks antes de lo último recibido,
 *   entre dos estados conocidos; si una instantánea se atrasa, se sigue de largo con su velocidad
 *   (2 ticks a lo más). Se probó proyectarlos al presente con su velocidad: se ven más
 *   "a tiempo", pero como la gente (y los bots) aceleran y sueltan a cada rato, la proyección
 *   falla en cada instantánea y el carro tiembla; con eso se le pegaba "al aire".
 *   Los choques no se predicen: los resuelve el servidor y llegan como una corrección suave.
 *   Para que nunca se vea un carro metido en el propio, en pantalla se le saca (solo visual).
 *
 * - La cámara compartida (en la partida) la calcula el servidor siguiendo al líder; aquí se
 *   interpola igual, con el reloj del servidor (`k`). Es la misma cámara con la que el servidor
 *   decide quién se salió de la imagen.
 *
 * - Espectador (ya explotaste, en una sala de 3 o más): con el mouse apuntas a la pista y con un
 *   clic tiras un meteorito. El servidor valida y lo suelta; aquí solo se apunta y se dibuja.
 */

const circuitos = Object.fromEntries(
  Object.values(import.meta.glob('./datos/circuitos/*.json', { eager: true, import: 'default' })).map((c) => [c.id, c]),
)

/** La cámara y los items sueltos se dibujan este tanto de ticks en el pasado (3 ticks a 30 Hz = 100 ms) */
const RETRASO_TICKS = 3
/**
 * Los demás carros, un poco menos en el pasado (2 ticks ≈ 66 ms): medido con lag y variación
 * simulados, tiemblan igual de poco que con 3 y se ven más cerca de donde están
 */
const RETRASO_OTROS = 2
/** Si una instantánea se atrasa, hasta cuántos ticks se sigue de largo con la última velocidad */
const MAX_DE_LARGO = 2
const MAX_HISTORIAL = 60
/** Si la predicción se equivocó por más que esto (un choque fuerte, reaparecer), se brinca sin suavizar */
const MAX_CORRECCION = 8
/** Diferencias menores son ruido de punto flotante entre navegadores: se ignoran */
const MIN_CORRECCION = 0.02
const CADA_PING = 2000
/** Los nombres sobre los carros: se ven en la cuenta y estos segundos de carrera, y luego se desvanecen */
const NOMBRES_SEGUNDOS = 3
const NOMBRES_DESVANECE = 0.8
/** En salas de al menos tantos jugadores, quien explota puede tirar meteoritos (igual que el servidor) */
const MIN_METEORITOS = 3

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
const mezclarCarro = (a, b, f) => ({ ...interpolarCarro(a, b, f), vivo: b.vivo })

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
  // Modo local: nobody looks at their phone, so each car shows its item over it
  escena.mostrarItems(!!sala.local)
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
  let cuantos = sala.jugadores.length

  function sincronizarSala(nueva) {
    const ids = new Set(nueva.jugadores.map((j) => j.id))
    cuantos = nueva.jugadores.length
    for (const j of nueva.jugadores) {
      if (enEscena.has(j.id)) continue
      escena.agregarCarro(j.id, colorCarro(j.color), j.nombre)
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
  /** Cuándo arrancó la carrera actual (reloj local, ms): para desvanecer los nombres */
  let inicioCarrera = 0
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

  /** Para el sonido: el último control (acelerador del motor) */
  let ultimoCtrl = { acel: 0 }

  /**
   * Postes y asadores (lo sólido y fijo en el piso), de la última instantánea. Como no se mueven,
   * el carro propio choca contra ellos en la predicción igual que en el servidor, en el mismo
   * orden (justo después de avanzar): pegarle a un poste no produce correcciones.
   */
  let estorbos = []
  function contraEstorbos(carro) {
    let golpe = 0
    for (const e of estorbos) golpe = Math.max(golpe, colisionFija(carro, e.x, e.y, e.radio, PARAMETROS_FISICA))
    return golpe
  }

  function pasoLocal() {
    const ctrl = entrada.leer()
    ultimoCtrl = ctrl
    seq++
    conexion.emitir(EVENTOS.controles, { seq, ...ctrl })
    pendientes.push({ seq, ctrl })
    if (pendientes.length > 120) pendientes.shift() // el servidor dejó de contestar
    // Marcas y polvo de los demás, desde donde se ven (al ritmo de la física)
    for (const [id, otro] of otros) if (otro.visual?.vivo) escena.registrarEfectos(id, otro.visual)
    if (!predicho || !puedoManejar()) return
    anterior = copiarCarro(predicho)
    const enTierra = !enElAire(predicho)
    const contraMuro = Math.max(avanzarCarro(predicho, ctrl, PARAMETROS_FISICA, pista, tick), contraEstorbos(predicho))
    // Off a ramp: whoosh (the landing comes back as a hit, like a wall)
    if (enTierra && enElAire(predicho)) sonido.efecto('salto', predicho)
    if (contraMuro > 5) sonido.efecto('muro', predicho, Math.min(1, contraMuro / 25))
    escena.registrarEfectos(miId, predicho)
  }

  function reconciliar(servidor, confirmado) {
    while (pendientes.length && pendientes[0].seq <= confirmado) pendientes.shift()

    // Estado del servidor + los controles que todavía no conoce (si es que el carro se mueve)
    const nuevo = copiarCarro(servidor)
    if (puedoManejar()) {
      for (const p of pendientes) {
        avanzarCarro(nuevo, p.ctrl, PARAMETROS_FISICA, pista, tick)
        contraEstorbos(nuevo)
      }
    }

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
    const antes = fase
    fase = FASES[inst.f] ?? 'espera'
    // Ronda nueva: pista limpia de marcas de llanta y quemadas de la ronda anterior
    if (fase === 'cuenta' && antes !== 'cuenta') escena.limpiarEfectos()
    if (fase === 'carrera' && antes !== 'carrera') inicioCarrera = performance.now()
    const ahora = relojLocal()
    const cam = inst.cam
      ? { x: inst.cam[0], y: inst.cam[1], h: inst.cam[2], rumbo: inst.cam[3], zoom: inst.cam[4] ?? 1, iniciada: true }
      : null
    const entidades = inst.e.map(([id, item, x, y, angulo, vida, etapa = 0]) => ({ id, item, x, y, angulo, vida, etapa }))
    estorbos = entidades
      .filter((e) => ITEMS[e.item]?.mecanica === 'estorbo')
      .map((e) => ({ x: e.x, y: e.y, radio: ITEMS[e.item].radio ?? 0.5 }))
    registrar(mundo, inst.k, { cam, entidades }, ahora)
    escena.ponerCajas(new Set(inst.ci), inst.cc)
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
      // The item rides along (modo local shows it over the car)
      if (!registrar(otro.linea, suSeq, { ...estado, vivo, item }, ahora)) {
        const ultimo = otro.linea.historial.at(-1)
        ultimo.valor = { ...estado, vivo, item }
      }
    }
  }

  function recibirEvento(evento) {
    switch (evento.tipo) {
      case 'explosion':
        escena.explotar(evento.x, evento.y, evento.motivo)
        sonido.efecto(evento.motivo === 'agua' ? 'salpicada' : 'explosion', evento)
        if (evento.id === miId) sonido.efecto('eliminado')
        break
      case 'golpe':
        escena.impacto(evento.x, evento.y, ITEMS[evento.item]?.color ?? '#ffffff')
        sonido.efecto(ITEMS[evento.item]?.id === 'charco' ? 'salpicada' : 'golpe', evento)
        break
      case 'choque':
        escena.impacto(evento.x, evento.y, evento.descontrolados.length ? '#F4B33A' : '#F1E6CC')
        if (evento.descontrolados.length) sonido.efecto('coletazo', evento)
        else sonido.efecto('choque', evento, Math.min(1, evento.fuerza / 20))
        break
      case 'item':
        if (evento.id === miId) sonido.efecto('item')
        break
      case 'usar':
        sonido.efecto(SONIDO_USAR[ITEMS[evento.item]?.id] ?? 'usar', evento)
        break
      case 'punto':
        if (evento.id) sonido.efecto('punto')
        break
      case 'meteorito':
        sonido.efecto('meteorito', evento)
        break
      case 'susto':
        // A whole group gets scared at once: one scream is enough
        if (performance.now() - ultimoSusto > 1500) {
          ultimoSusto = performance.now()
          sonido.efecto('susto', evento)
        }
        break
      case 'atropello':
        // Like the meteor: what's loose is drawn RETRASO_TICKS in the past
        setTimeout(() => {
          if (destruido) return
          escena.atropellar(evento)
          sonido.efecto('atropello', evento)
        }, RETRASO_TICKS * tick * 1000)
        break
      case 'impacto':
        // Lo suelto se dibuja RETRASO_TICKS en el pasado: el golpe espera a que la roca llegue al piso
        setTimeout(() => {
          if (destruido) return
          escena.explotar(evento.x, evento.y)
          sonido.efecto('impacto', evento)
        }, RETRASO_TICKS * tick * 1000)
        break
    }
    alEvento?.(evento)
  }

  /**
   * Dónde dibujar a otro carro en el tick `t` de su reloj: entre los dos estados que lo rodean.
   * Si su instantánea se atrasó y `t` ya pasó lo último recibido, sigue de largo con su velocidad
   * (MAX_DE_LARGO ticks a lo más) en vez de quedarse congelado y luego brincar.
   */
  function otroEn(linea, t) {
    const ultimo = linea.historial.at(-1)
    if (t <= ultimo.t) return valorEn(linea, t, mezclarCarro)
    const v = ultimo.valor
    if (!FASES_CON_MANEJO.includes(fase) || !v.vivo) return v
    const s = Math.min(MAX_DE_LARGO, t - ultimo.t) * tick
    return { ...v, x: v.x + v.vx * s, y: v.y + v.vy * s, angulo: v.angulo + v.w * s }
  }

  /* ------------------------------ Meteoritos ------------------------------ */

  /** Dónde apunta el mouse en el piso (o null) y desde cuándo hay otro meteorito (reloj local, ms) */
  let ultimoSusto = 0
  let apuntado = null
  let meteoritoListo = 0
  let lanzando = false
  let destruido = false
  const puedoLanzar = () => fase === 'carrera' && !miVivo && cuantos >= MIN_METEORITOS

  function puntoDelMouse(evento) {
    const caja = canvas.getBoundingClientRect()
    const nx = ((evento.clientX - caja.left) / caja.width) * 2 - 1
    const ny = -(((evento.clientY - caja.top) / caja.height) * 2 - 1)
    return escena.sueloEn(nx, ny)
  }

  function alMover(evento) {
    apuntado = puedoLanzar() ? puntoDelMouse(evento) : null
  }

  async function alClic(evento) {
    if (!puedoLanzar() || lanzando || performance.now() < meteoritoListo) return
    const punto = puntoDelMouse(evento)
    if (!punto) return
    lanzando = true
    try {
      const r = await conexion.pedir(EVENTOS.meteorito, punto)
      if (r.ok) meteoritoListo = performance.now() + r.recargaMs
      else avisar(r.error)
    } catch (e) {
      avisar(e.message)
    } finally {
      lanzando = false
    }
  }
  /** El último "no se pudo" del servidor, para el HUD (unos segundos) */
  let avisoMeteorito = ''
  let relojAviso = 0
  function avisar(texto) {
    avisoMeteorito = texto
    clearTimeout(relojAviso)
    relojAviso = setTimeout(() => (avisoMeteorito = ''), 2500)
  }
  const alSalir = () => (apuntado = null)

  canvas.addEventListener('pointermove', alMover)
  canvas.addEventListener('pointerdown', alClic)
  canvas.addEventListener('pointerleave', alSalir)

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
    for (const [id, otro] of otros) {
      const linea = otro.linea
      if (!linea.historial.length) continue
      const visual = otroEn(linea, local + linea.desfase - RETRASO_OTROS)
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

    // Nadie se dibuja metido en el carro propio: el mío va un poco adelante en el tiempo que los
    // demás (predicción contra interpolación), así que al tocarse se le saca al otro en pantalla
    // hasta que llega el choque del servidor. Entre dos ajenos no hace falta: los dos se dibujan
    // en el mismo instante del servidor, que ya los separó. Solo visual.
    if (mio) for (const e of estados) if (e.id !== miId) separarEnPantalla(e.estado, mio)
    for (const { id, estado } of estados) if (id !== miId && otros.has(id)) otros.get(id).visual = estado

    // ?debug: what's on screen this frame, for testing tools
    if (debug) window.__juegoEstados = estados.map(({ id, estado }) => ({ id, x: estado.x, y: estado.y, angulo: estado.angulo }))

    // Cámara compartida e items sueltos del servidor, un poco en el pasado (suaves)
    const delServidor = mundo.historial.length ? valorEn(mundo, local + mundo.desfase - RETRASO_TICKS, mezclarMundo) : null
    escena.ponerEntidades(delServidor?.entidades ?? [])

    // Los nombres: completos en la cuenta y los primeros segundos de carrera, luego se van (ease out)
    let nombres = 0
    if (fase === 'cuenta') nombres = 1
    else if (fase === 'carrera') {
      const f = Math.min(1, Math.max(0, ((ahora - inicioCarrera) / 1000 - NOMBRES_SEGUNDOS) / NOMBRES_DESVANECE))
      nombres = 1 - (1 - (1 - f) ** 3)
    }
    escena.ponerNombres(nombres)

    // La mira del espectador
    const meteoritoListoYa = ahora >= meteoritoListo && !lanzando
    escena.ponerMira(puedoLanzar() ? apuntado : null, meteoritoListoYa)
    canvas.style.cursor = puedoLanzar() ? 'crosshair' : ''

    // En la partida, la cámara compartida del servidor; en la sala de espera, la propia
    let fueraDeVista = false
    if (delServidor?.cam) {
      escena.dibujar(estados, delServidor.cam, dt, PARAMETROS_CAMARA_PARTIDA)
      // ¿Me estoy saliendo de la imagen? Aviso para intentar el último recobro (la regla la decide el servidor)
      fueraDeVista = fase === 'carrera' && !!mio && !enVista(delServidor.cam, mio.x, mio.y, alturaEn(pista, mio.x, mio.y))
    } else {
      // Nobody to follow yet (the modo local screen before anyone joins): the start line
      const [sx, sy] = pista.puntos[0]
      const seguido = mio ?? estados[0]?.estado ?? { x: sx, y: sy, indice: 0 }
      seguir(camaraPropia, pista, { ...seguido, altura: alturaEn(pista, seguido.x, seguido.y) }, dt)
      escena.dibujar(estados, camaraPropia, dt, PARAMETROS_CAMARA)
    }

    // Sonido: se oye desde la cámara; el motor propio y los de los demás, cada uno en su lugar
    const camara = delServidor?.cam ?? camaraPropia
    sonido.oyente(camara.x, camara.y, camara.rumbo)
    if (predicho) {
      const adelante = predicho.vx * Math.cos(predicho.angulo) + predicho.vy * Math.sin(predicho.angulo)
      sonido.motor({
        velocidad: Math.min(1.2, adelante / PARAMETROS_FISICA.velocidadMax),
        acel: puedoManejar() ? ultimoCtrl.acel : 0,
        derrape: predicho.derrape,
        tierra: predicho.suelo === 'tierra',
        activo: miVivo && fase !== 'resultados',
      })
    }
    sonido.otrosMotores(
      estados
        .filter(({ id }) => id !== miId)
        .map(({ id, estado }) => ({ id, x: estado.x, y: estado.y, velocidad: Math.hypot(estado.vx, estado.vy) / PARAMETROS_FISICA.velocidadMax })),
    )

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
        // Espectador: si puede tirar meteoritos y en cuánto tiempo (s) le toca otro
        meteorito: puedoLanzar() ? { recarga: Math.max(0, (meteoritoListo - ahora) / 1000), aviso: avisoMeteorito } : null,
      })
    }
  }

  cuadro = requestAnimationFrame(dibujar)

  return {
    sonido,
    destruir() {
      destruido = true
      canvas.removeEventListener('pointermove', alMover)
      canvas.removeEventListener('pointerdown', alClic)
      canvas.removeEventListener('pointerleave', alSalir)
      canvas.style.cursor = ''
      clearTimeout(relojAviso)
      cancelAnimationFrame(cuadro)
      clearInterval(relojPing)
      dejar.forEach((f) => f())
      entrada.destruir()
      sonido.destruir()
      escena.destruir()
    },
  }
}

/** Saca a `mover` de encima de `fijo` (círculos de la caja de choque), sin tocar a `fijo` */
function separarEnPantalla(mover, fijo) {
  const minimo = PARAMETROS_FISICA.choque.radio * 2
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
      mover.x += nx * (minimo - d)
      mover.y += ny * (minimo - d)
    }
  }
}

function diferenciaAngulo(a, b) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
