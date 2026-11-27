<script setup>
/**
 * ONE MATCH (admin → Status → a match): every real player side by side, to see why one lags and
 * another doesn't. Per player: their device, the diagnosis (render, downlink, uplink, ping,
 * prediction) and the numbers behind it, what their client reports (every ~2 s) next to what the
 * server sees of them. Below, the charts with one line per player in their car's color.
 * Refreshes every 3 s while the match runs.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getPartidaJuego } from '../../api/admin'
import { mensajeError } from '../../api/client'
import GraficaLinea from './GraficaLinea.vue'
import { NOMBRES_BANDERA, colorJugador, duracion, iconoDispositivo, peorNivel, textoDispositivo } from './juego.util'

const CADA_MS = 3000

const route = useRoute()
const datos = ref(null)
const error = ref(null)
/** "ahora" (last 30 s, while it runs) or "total" (the whole match) */
const vista = ref('ahora')
let reloj = null
let pedido = null

async function cargar() {
  if (document.hidden) return
  pedido?.abort()
  pedido = new AbortController()
  try {
    datos.value = await getPartidaJuego(route.params.partida, pedido.signal)
    error.value = null
    // Over: nothing new will come
    if (datos.value.fin !== null) {
      clearInterval(reloj)
      vista.value = 'total'
    }
  } catch (err) {
    if (err?.name !== 'AbortError') error.value = err
  }
}

const alCambiarVisibilidad = () => !document.hidden && datos.value?.fin === null && cargar()

function empezar() {
  clearInterval(reloj)
  datos.value = null
  cargar()
  reloj = setInterval(cargar, CADA_MS)
}

onMounted(() => {
  empezar()
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
})
watch(() => route.params.partida, empezar)

onBeforeUnmount(() => {
  clearInterval(reloj)
  pedido?.abort()
  document.removeEventListener('visibilitychange', alCambiarVisibilidad)
})

const enCurso = computed(() => datos.value?.fin === null)
const jugadores = computed(() => datos.value?.jugadores ?? [])
const estadoHz = computed(() => datos.value?.servidorActual?.estadoHz ?? 30)

const resumenDe = (j) => (vista.value === 'ahora' && j.ahora ? j.ahora : j.total)
const banderasDe = (j) => (vista.value === 'ahora' && j.ahora ? j.banderasAhora : j.banderas)

/** Arranque de ronda (primeros 5 s) contra el resto de la carrera: [etiqueta, valor de un resumen] */
const COMPARAR_TRAMOS = [
  ['Correcciones', (r) => v(r.correccionesPorS, ' /s')],
  ['Correcciones duras', (r) => v(r.correccionesDurasPorMin, ' /min')],
  ['Error de choque p95', (r) => v(r.errorChoqueP95, ' m')],
  ['Adivina a los cercanos p95', (r) => v(r.incertidumbreP95, ' ms')],
  ['Otros carros que saltan', (r) => v(r.brincosOtrosPorMin, ' /min')],
  ['Hueco de estados p95', (r) => v(r.huecoP95, ' ms')],
  ['Cámara quieta', (r) => v(r.camaraQuietaMsPorMin, ' ms/min')],
  ['Cámara lenta', (r) => v(r.camaraLentaMsPorMin, ' ms/min')],
  ['Ping p95', (r) => v(r.rttP95, ' ms')],
]

const v = (x, unidad = '') => (x === null || x === undefined ? '—' : `${x}${unidad}`)

/**
 * The rows of each player's table: [label, value, bad?]. "Cliente" is what their game reports,
 * "Servidor" what the server sees of them
 */
function filas(j) {
  const r = resumenDe(j)
  const esperado = Math.round((1000 / estadoHz.value) * 10) / 10
  return [
    { grupo: 'Render (cliente)' },
    ['fps (mediana / mín.)', `${v(r.fps)} / ${v(r.fpsMin)}`, r.fps !== null && r.fps < 45],
    ['Cuadro p95 / máx.', `${v(r.cuadroP95, ' ms')} / ${v(r.cuadroMax, ' ms')}`, (r.cuadroP95 ?? 0) > 25],
    ['Cuadros de más de 50 ms', v(r.cuadrosLargosPct, ' %'), (r.cuadrosLargosPct ?? 0) > 2],
    ['Calidad', r.perfil ? `${r.perfil} (nivel ${r.nivelCalidad})` : '— (compu)', false],
    ['Estuvo en segundo plano', r.oculto ? 'sí' : 'no', r.oculto],
    { grupo: 'Canal' },
    ['Canal rápido (WebRTC) abierto', v(r.canalRapidoPct, ' % del tiempo'), (r.canalRapidoPct ?? 100) < 50],
    ['Canal rápido por el relevo TURN', v(r.canalRelevoPct, ' %'), false],
    ['Estados que llegaron por el canal rápido', v(r.estadosPorCanalPct, ' %'), false],
    { grupo: 'Bajada: estados del servidor (cliente)' },
    ['Recibidos', v(r.estadosPct, ' %'), (r.estadosPct ?? 100) < 90],
    [`Hueco p95 / máx. (esperado ${esperado} ms)`, `${v(r.huecoP95, ' ms')} / ${v(r.huecoMax, ' ms')}`, (r.huecoP95 ?? 0) > esperado * 2],
    ['Atraso p95', v(r.atraso, ' ms'), false],
    ['Colchón de los otros carros', v(r.colchonOtros, ' ms'), (r.colchonOtros ?? 0) > 150],
    ['Sin estado, de largo', v(r.deLargoPorS, ' /s'), (r.deLargoPorS ?? 0) > 1],
    ['Cámara sin estado nuevo (siguió de largo)', v(r.camaraDeLargoPct, ' % de cuadros'), (r.camaraDeLargoPct ?? 0) > 5],
    ['Cámara quieta (se le acabaron los estados)', v(r.camaraQuietaMsPorMin, ' ms/min'), (r.camaraQuietaMsPorMin ?? 0) > 200],
    ['Cámara lenta (frenando por un estado tarde)', v(r.camaraLentaMsPorMin, ' ms/min'), (r.camaraLentaMsPorMin ?? 0) > 1000],
    { grupo: 'Ping y predicción (cliente)' },
    ['Ping p50 / p95 / p99', `${v(r.rttP50)} / ${v(r.rttP95)} / ${v(r.rttP99)} ms`, (r.rttP95 ?? 0) > 150],
    ['Confirmación de controles p95', v(r.confirmacionP95, ' ms'), false],
    ['Retraso de envío p95', v(r.envioP95, ' ms'), (r.envioP95 ?? 0) > 20],
    ['Correcciones', v(r.correccionesPorS, ' /s'), (r.correccionesPorS ?? 0) > 2],
    ['Error de choque p95 (con carros cerca) / peor ventana', `${v(r.errorChoqueP95, ' m')} / ${v(r.errorChoqueMax, ' m')}`, (r.errorChoqueP95 ?? 0) > 1],
    ['Adivina a los carros cercanos (colchón + ping) p95', v(r.incertidumbreP95, ' ms'), (r.incertidumbreP95 ?? 0) > 150],
    ['Error de choque p95: red buena / red mala', `${v(r.errorChoqueBuenaP95, ' m')} / ${v(r.errorChoqueMalaP95, ' m')}`, (r.errorChoqueMalaP95 ?? 0) > 3],
    ['Golpes predichos suavizados (red mala)', v(r.choquesSuavizadosPct, ' %'), false],
    { grupo: 'Brincos (cliente)' },
    ['Correcciones duras (más de 8 m)', v(r.correccionesDurasPorMin, ' /min'), (r.correccionesDurasPorMin ?? 0) > 0.5],
    ['Detenido esperando al servidor', v(r.congeladoSPorMin, ' s/min'), (r.congeladoSPorMin ?? 0) > 1],
    ['Corrección p95 / máx.', `${v(r.correccionP95, ' m')} / ${v(r.correccionMax, ' m')}`, (r.correccionP95 ?? 0) > 1],
    ['Otros carros que saltan', `${v(r.brincosOtrosPorMin, ' /min')} (máx. ${v(r.brincoOtrosMax, ' m')})`, (r.brincosOtrosPorMin ?? 0) > 1],
    ['Hueco de estados en esos saltos', v(r.huecoEnBrincosOtros, ' ms'), (r.huecoEnBrincosOtros ?? 0) > (1000 / estadoHz.value) * 2],
    ['Cuadros de más de 100 ms', v(r.cuadrosMuyLargosPorMin, ' /min'), (r.cuadrosMuyLargosPorMin ?? 0) > 1],
    { grupo: 'Subida: sus controles (servidor)' },
    ['Controles que llegan', v(r.controlesPorS, ' /s'), false],
    ['Hueco p95 / máx.', `${v(r.controlesHuecoP95, ' ms')} / ${v(r.controlesHuecoMax, ' ms')}`, (r.controlesHuecoP95 ?? 0) > 50],
    ['Ticks cubiertos repitiendo su control', `${v(r.inventadosPorS, ' /s')} (${v(r.cubiertosPorS, ' /s')} llegaron tarde)`, false],
    ['Ticks quieto (hueco de más de 0.35 s)', v(r.hambrePorS, ' /s'), (r.hambrePorS ?? 0) > 1],
    ['Tirados (cola llena)', v(r.tirados), (r.tirados ?? 0) > 0],
    ['Perdidos (nunca llegaron)', v(r.perdidos), (r.perdidos ?? 0) > 0],
    ['Cola del socket (máx.)', v(r.bufferMax), (r.bufferMax ?? 0) > 20],
  ]
}

/* ------------------------------ Charts ------------------------------ */

/** One point per player sample, keyed by player index: the chart draws one line per player */
function puntosDe(valor) {
  const puntos = []
  jugadores.value.forEach((j, i) => {
    for (const m of j.muestras) {
      const x = valor(m)
      if (x !== undefined) puntos.push({ t: m.t, [`j${i}`]: x })
    }
  })
  return puntos.sort((a, b) => a.t - b.t)
}

const seriesJugadores = computed(() =>
  jugadores.value.map((j, i) => ({ clave: `j${i}`, nombre: j.nombre, color: colorJugador(j.color) })),
)

const seg = (m) => m.servidor.ventanaMs / 1000
const graficas = computed(() => [
  { titulo: 'fps', puntos: puntosDe((m) => m.cliente?.fps ?? null) },
  { titulo: 'Cuadro p95', unidad: ' ms', puntos: puntosDe((m) => m.cliente?.cuadroP95 ?? null) },
  { titulo: 'Hueco entre estados p95', unidad: ' ms', limite: (1000 / estadoHz.value) * 2, puntos: puntosDe((m) => m.cliente?.huecoP95 ?? null) },
  { titulo: 'Estados recibidos', unidad: ' /s', limite: estadoHz.value, puntos: puntosDe((m) => (m.cliente ? Math.round((m.cliente.estados / (m.cliente.ventanaMs / 1000)) * 10) / 10 : null)) },
  { titulo: 'Ping p95', unidad: ' ms', limite: 150, puntos: puntosDe((m) => m.cliente?.rttP95 ?? null) },
  { titulo: 'Hueco de controles p95 (servidor)', unidad: ' ms', limite: 50, puntos: puntosDe((m) => m.servidor.huecoP95) },
  { titulo: 'Ticks cubiertos repitiendo (servidor)', unidad: ' /s', puntos: puntosDe((m) => Math.round(((m.servidor.inventados ?? 0) / seg(m)) * 10) / 10) },
  { titulo: 'Ticks quieto (servidor)', unidad: ' /s', puntos: puntosDe((m) => Math.round((m.servidor.hambre / seg(m)) * 10) / 10) },
  { titulo: 'Correcciones', unidad: ' /s', puntos: puntosDe((m) => (m.cliente ? Math.round((m.cliente.correcciones / (m.cliente.ventanaMs / 1000)) * 10) / 10 : null)) },
  { titulo: 'Colchón de los otros carros', unidad: ' ms', puntos: puntosDe((m) => m.cliente?.colchonOtros ?? null) },
  { titulo: 'Colchón de la cámara', unidad: ' ms', puntos: puntosDe((m) => m.cliente?.colchonCamara ?? null) },
  {
    titulo: 'Cámara sin estado nuevo',
    unidad: ' %',
    puntos: puntosDe((m) => (m.cliente && m.cliente.camaraDeLargo !== undefined && m.cliente.cuadros ? Math.round((m.cliente.camaraDeLargo / m.cliente.cuadros) * 1000) / 10 : null)),
  },
  {
    titulo: 'Brincos (propios duros + otros)',
    unidad: ' /min',
    puntos: puntosDe((m) =>
      m.cliente && m.cliente.correccionesDuras !== undefined
        ? Math.round((((m.cliente.correccionesDuras ?? 0) + (m.cliente.brincosOtros ?? 0)) / (m.cliente.ventanaMs / 60000)) * 10) / 10
        : null,
    ),
  },
])

const presupuesto = computed(() => 1000 / (datos.value?.servidorActual?.tickHz ?? 60))

/** Los tirones del servidor: qué lo detuvo, cuándo (desde el inicio de la partida) y su contexto */
const NOMBRE_TIRON = { tick: 'Tick lento', controles: 'Ráfaga de controles', estado: 'Mandar el estado', gc: 'Recolector de basura (GC)' }
const segundoDe = (t) => `+${((t - (datos.value?.inicio ?? t)) / 1000).toFixed(1)} s`
const detalleTiron = (d) => (d ? Object.entries(d).map(([k, v]) => `${k} ${v}`).join(' · ') : '')

/* ------------------------- Server health ------------------------- */

/** Lo del servidor entero durante la partida (las partidas guardadas antes no lo traen: null) */
const salud = computed(() => datos.value?.servidor?.salud ?? null)
const inicioServidor = computed(() => datos.value?.servidor?.inicio ?? null)
const vecinos = computed(() => datos.value?.servidor?.vecinos ?? [])
const llamadasBase = computed(() => datos.value?.servidor?.base ?? [])
const NOMBRE_BASE = { usarBoleto: 'Cobrar boleto', premiarMulti: 'Pagar lugar', premiarCopa: 'Premiar copa' }
const r1 = (x) => Math.round(x * 10) / 10

/** The server samples (every 5 s) flattened for the charts; undefined where an old sample lacks it */
const puntosServidor = computed(() =>
  (datos.value?.servidor?.muestras ?? []).map((m) => ({
    t: m.t,
    tickP95: m.tickP95,
    tickMax: m.tickMax,
    cpu: m.cpu,
    cpuSala: m.sala?.cpuPct,
    jugando: m.carga?.jugando,
    personas: m.carga?.humanos,
    bots: m.carga?.bots,
    heap: m.memoria?.heapMb,
    rss: m.memoria?.rssMb,
    gcMsPorS: m.gc ? r1(m.gc.ms / 5) : undefined,
    gcMax: m.gc?.maxMs,
    kbPorS: m.sala?.kbPorS,
    bufferKb: m.sala ? r1(m.sala.canalBufferMax / 1024) : undefined,
    bucleP50: m.bucleP50,
    bucleP95: m.bucleP95,
    bucleMax: m.bucleMax,
    continuaciones: m.sala?.continuaciones,
  })),
)

const graficasServidor = computed(() => [
  { titulo: 'Tick de esta sala', unidad: ' ms', limite: presupuesto.value, series: [{ clave: 'tickP95', nombre: 'p95', color: 'var(--accent)' }, { clave: 'tickMax', nombre: 'máx.', color: 'var(--calor)' }] },
  { titulo: 'CPU (% de un núcleo)', unidad: ' %', limite: 70, series: [{ clave: 'cpu', nombre: 'todo el servidor', color: 'var(--calor)' }, { clave: 'cpuSala', nombre: 'esta sala', color: 'var(--accent)' }] },
  { titulo: 'Carga del servidor', series: [{ clave: 'jugando', nombre: 'salas jugando', color: 'var(--accent)' }, { clave: 'personas', nombre: 'personas', color: 'var(--calor)' }, { clave: 'bots', nombre: 'bots', color: 'var(--muted, #888)' }] },
  { titulo: 'Event loop (retraso)', unidad: ' ms', limite: 16.7, series: [{ clave: 'bucleP50', nombre: 'p50', color: 'var(--accent)' }, { clave: 'bucleP95', nombre: 'p95', color: 'var(--calor)' }, { clave: 'bucleMax', nombre: 'máx.', color: 'var(--extremo)' }] },
  { titulo: 'Memoria', unidad: ' MB', limite: salud.value?.heapLimiteMb ? r1(salud.value.heapLimiteMb * 0.8) : null, series: [{ clave: 'heap', nombre: 'heap', color: 'var(--accent)' }, { clave: 'rss', nombre: 'rss', color: 'var(--calor)' }] },
  { titulo: 'Recolector de basura (GC)', unidad: ' ms', series: [{ clave: 'gcMsPorS', nombre: 'ms/s', color: 'var(--accent)' }, { clave: 'gcMax', nombre: 'pausa máx.', color: 'var(--calor)' }] },
  { titulo: 'Estado de esta sala', unidad: ' KB', series: [{ clave: 'kbPorS', nombre: 'KB/s por jugador', color: 'var(--accent)' }, { clave: 'bufferKb', nombre: 'esperando en el canal', color: 'var(--calor)' }] },
  { titulo: 'Turnos atrasados de esta sala', unidad: ' /5 s', series: [{ clave: 'continuaciones', nombre: 'siguió con setImmediate', color: 'var(--calor)' }] },
])

/** The health summary rows: [label, value, bad?] */
const filasSalud = computed(() => {
  const s = salud.value
  if (!s) return []
  return [
    ['Salas jugando / en el servidor (máx.)', `${s.jugandoMax} / ${s.salasMax}`, false],
    ['Personas / bots en el servidor (máx.)', `${s.personasMax} / ${s.botsMax}`, false],
    ['CPU de todo el servidor (máx.)', `${s.cpuMax} % de un núcleo`, s.cpuMax > 70],
    ['CPU de esta sala (mediana / máx.)', `${s.cpuSalaMediana} / ${s.cpuSalaMax} %`, false],
    ['Event loop p95 (peor muestra)', `${s.bucleP95Max} ms`, s.bucleP95Max > presupuesto.value],
    ['GC', `${s.gcMsPorS} ms/s (pausa máx. ${s.gcMaxMs} ms)`, s.gcMsPorS > 20],
    ['Heap (máx. / límite)', `${s.heapMaxMb} / ${s.heapLimiteMb} MB`, s.heapLimiteMb && s.heapMaxMb / s.heapLimiteMb > 0.8],
    ['Estado típico', s.bytesEstado ? `${s.bytesEstado} bytes (hasta ${s.kbPorSMax} KB/s por jugador)` : '—', false],
    ['Esperando en el canal rápido (máx.)', `${r1(s.canalBufferMax / 1024)} KB`, s.canalBufferMax > 64 * 1024],
    ['Otras salas que lo detuvieron (15 ms o más)', `${vecinos.value.length}`, vecinos.value.some((t) => t.ms >= 40)],
  ]
})

/* ------------------------------ Brincos ------------------------------ */

const TEXTO_BRINCO = {
  'propio-duro': (e) => `su carro se brincó ${e.valor} m (corrección dura)`,
  otro: (e) => `otro carro saltó ${e.valor} m`,
  'cuadro-largo': (e) => `un cuadro tardó ${Math.round(e.valor)} ms`,
}

/** The last jumps of a player, newest first, with their context */
const brincosDe = (j) => [...(resumenDe(j).ultimosBrincos ?? [])].reverse().slice(0, 12)

/* ---------------------------- Download ---------------------------- */

/** The whole match as JSON (what the server keeps), ready to analyze */
function descargar() {
  const d = datos.value
  if (!d) return
  const fecha = new Date(d.inicio).toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `partida-${d.codigo}-${fecha}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
</script>

<template>
  <section class="partida-juego">
    <RouterLink :to="{ name: 'admin-status' }" class="partida-juego__volver">← Todas las partidas</RouterLink>

    <p v-if="error" class="partida-juego__error" role="alert">{{ mensajeError(error) }}</p>
    <p v-else-if="!datos" class="muted">Cargando…</p>

    <template v-if="datos">
      <div class="partida-juego__cabecera">
        <h2 class="partida-juego__titulo">{{ datos.codigo }}</h2>
        <span class="muted">{{ datos.circuito }} · {{ datos.tipo }}</span>
        <span class="muted">
          <template v-if="enCurso">En curso ({{ datos.fase }}) · {{ duracion(datos.inicio) }}</template>
          <template v-else>Terminó · {{ new Date(datos.inicio).toLocaleString() }} · duró {{ duracion(datos.inicio, datos.fin) }}</template>
        </span>
        <button type="button" class="btn btn--sm btn--ghost partida-juego__descargar" @click="descargar">
          Descargar JSON
        </button>
        <div v-if="enCurso" class="selector" role="group" aria-label="Periodo">
          <button type="button" class="btn btn--sm" :class="{ 'btn--ghost': vista !== 'ahora' }" @click="vista = 'ahora'">Últimos 30 s</button>
          <button type="button" class="btn btn--sm" :class="{ 'btn--ghost': vista !== 'total' }" @click="vista = 'total'">Toda la partida</button>
        </div>
      </div>

      <p class="servidor muted">
        <b>Servidor en esta partida:</b> tick p95 {{ datos.servidor.tickP95 }} ms (máx. {{ datos.servidor.tickMax }} ms) de
        {{ Math.round(presupuesto * 10) / 10 }} ms ·
        <span v-if="datos.servidor.banderas.length" class="malo">{{ datos.servidor.banderas.map((b) => b.texto).join(' · ') }}</span>
        <span v-else>va sobrado: no es el servidor</span>
        <template v-if="salud">
          · {{ salud.jugandoMax }} salas jugando y {{ salud.personasMax }} personas en el servidor (máx.) · CPU hasta {{ salud.cpuMax }} %
          (esta sala {{ salud.cpuSalaMediana }} %) · heap hasta {{ salud.heapMaxMb }} MB
        </template>
        <template v-if="datos.config?.repetirControl !== undefined">
          · repetir control en huecos: <b>{{ datos.config.repetirControl ? 'sí' : 'no' }}</b>
        </template>
        <template v-if="datos.config?.proyectar !== undefined">
          · proyección de los demás: <b>{{ datos.config.proyectar ? 'sí' : 'no (solo interpolados)' }}</b>
        </template>
      </p>

      <details v-if="datos.servidor.tirones?.length" class="tirones">
        <summary>
          <b>Tirones del servidor</b> ({{ datos.servidor.tirones.length }}): lo que lo detuvo; en rojo, los que se notan (40 ms o más)
        </summary>
        <table>
          <thead>
            <tr><th>Cuándo</th><th>Qué</th><th>ms</th><th>Contexto</th></tr>
          </thead>
          <tbody>
            <tr v-for="(t, i) in datos.servidor.tirones" :key="i" :class="{ malo: t.ms >= 40 }">
              <td>{{ segundoDe(t.t) }}</td>
              <td>{{ NOMBRE_TIRON[t.tipo] ?? t.tipo }}</td>
              <td>{{ t.ms }}</td>
              <td class="muted">{{ detalleTiron(t.detalle) }}</td>
            </tr>
          </tbody>
        </table>
      </details>

      <details v-if="salud || inicioServidor" class="tirones">
        <summary><b>Salud del servidor</b>: todo el servidor durante la partida (no solo esta sala)</summary>
        <table>
          <tbody>
            <tr v-for="[etiqueta, valor, malo] in filasSalud" :key="etiqueta" :class="{ malo }">
              <td>{{ etiqueta }}</td>
              <td>{{ valor }}</td>
            </tr>
            <template v-if="inicioServidor">
              <tr><td>Versión del servidor</td><td>{{ inicioServidor.version ?? '—' }} · Node {{ inicioServidor.node }}</td></tr>
              <tr>
                <td>Al empezar</td>
                <td>
                  {{ inicioServidor.carga.jugando }} salas jugando de {{ inicioServidor.carga.salas }}, {{ inicioServidor.carga.humanos }} personas,
                  {{ inicioServidor.carga.sockets }} sockets · encendido hace {{ duracion(inicioServidor.t - inicioServidor.uptime * 1000, inicioServidor.t) }}
                </td>
              </tr>
              <tr>
                <td>Máquina</td>
                <td>
                  {{ inicioServidor.nucleos }} núcleos · {{ inicioServidor.memoriaLibreMb }} de {{ inicioServidor.memoriaTotalMb }} MB libres · carga
                  {{ inicioServidor.cargaPromedio.join(' / ') }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </details>

      <details v-if="vecinos.length" class="tirones">
        <summary>
          <b>Otras salas que detuvieron el servidor</b> ({{ vecinos.length }}): el servidor es uno, así que también detuvieron esta partida; en rojo, 40 ms o más
        </summary>
        <table>
          <thead>
            <tr><th>Cuándo</th><th>Sala</th><th>Qué</th><th>ms</th><th>Contexto</th></tr>
          </thead>
          <tbody>
            <tr v-for="(t, i) in vecinos" :key="i" :class="{ malo: t.ms >= 40 }">
              <td>{{ segundoDe(t.t) }}</td>
              <td>{{ t.sala }} <span class="muted">({{ t.circuito }})</span></td>
              <td>{{ NOMBRE_TIRON[t.tipo] ?? t.tipo }}</td>
              <td>{{ t.ms }}</td>
              <td class="muted">{{ detalleTiron(t.detalle) }}</td>
            </tr>
          </tbody>
        </table>
      </details>

      <details v-if="llamadasBase.length" class="tirones">
        <summary><b>Llamadas a la base</b> ({{ llamadasBase.length }}): boletos y premios; en rojo, más de 500 ms</summary>
        <table>
          <thead>
            <tr><th>Cuándo</th><th>Qué</th><th>ms</th></tr>
          </thead>
          <tbody>
            <tr v-for="(b, i) in llamadasBase" :key="i" :class="{ malo: b.ms > 500 }">
              <td>{{ segundoDe(b.t) }}</td>
              <td>{{ NOMBRE_BASE[b.que] ?? b.que }}</td>
              <td>{{ b.ms }}</td>
            </tr>
          </tbody>
        </table>
      </details>

      <p v-if="!jugadores.length" class="muted">Todavía no llega ningún reporte (los manda cada jugador cada 2 s).</p>

      <div class="columnas">
        <article v-for="j in jugadores" :key="j.id" class="columna card" :class="`columna--${peorNivel(banderasDe(j))}`">
          <header class="columna__cabecera">
            <span class="columna__color" :style="{ background: colorJugador(j.color) }"></span>
            <h3 class="columna__nombre">{{ j.nombre }}</h3>
            <span v-if="!j.sigue && enCurso" class="muted">(salió)</span>
          </header>
          <p class="columna__dispositivo muted">
            {{ iconoDispositivo(j.dispositivo) }} {{ textoDispositivo(j.dispositivo) }}
            <template v-if="j.dispositivo"> · {{ j.dispositivo.ancho }}×{{ j.dispositivo.alto }} @{{ j.dispositivo.dpr }}x</template>
          </p>
          <p v-if="j.dispositivo" class="columna__ua muted" :title="j.dispositivo.ua">{{ j.dispositivo.ua }}</p>

          <ul class="banderas">
            <li v-for="b in banderasDe(j)" :key="b.clave" class="bandera" :class="`bandera--${b.nivel}`">
              <b>{{ NOMBRES_BANDERA[b.clave] }}:</b> {{ b.texto }}
            </li>
            <li v-if="!banderasDe(j).length" class="bandera bandera--bien">Sin problemas en este periodo.</li>
          </ul>

          <template v-if="j.porTramo?.arranque?.muestras">
            <h4 class="columna__subtitulo">Arranque de ronda (primeros 5 s) vs resto</h4>
            <table class="numeros tramos">
              <thead>
                <tr><th></th><th>Arranque</th><th>Resto</th></tr>
              </thead>
              <tbody>
                <tr v-for="[etiqueta, valor] in COMPARAR_TRAMOS" :key="etiqueta">
                  <td>{{ etiqueta }}</td>
                  <td class="numeros__valor">{{ valor(j.porTramo.arranque) }}</td>
                  <td class="numeros__valor">{{ valor(j.porTramo.resto) }}</td>
                </tr>
              </tbody>
            </table>
          </template>

          <table class="numeros">
            <tbody>
              <template v-for="(f, i) in filas(j)" :key="i">
                <tr v-if="f.grupo" class="numeros__grupo"><th colspan="2">{{ f.grupo }}</th></tr>
                <tr v-else :class="{ 'numeros__fila--mala': f[2] }">
                  <td>{{ f[0] }}</td>
                  <td class="numeros__valor">{{ f[1] }}</td>
                </tr>
              </template>
            </tbody>
          </table>
          <template v-if="brincosDe(j).length">
            <h4 class="columna__subtitulo">Últimos brincos</h4>
            <ul class="brincos">
              <li v-for="(e, i) in brincosDe(j)" :key="i">
                <span class="muted">{{ new Date(e.t).toLocaleTimeString() }}</span>
                {{ TEXTO_BRINCO[e.tipo]?.(e) ?? e.tipo }}
                <span class="muted" :class="{ malo: e.hueco > (1000 / estadoHz) * 2 }">· hueco {{ e.hueco }} ms</span>
              </li>
            </ul>
          </template>
          <p class="muted columna__muestras">{{ resumenDe(j).muestras }} muestras ({{ resumenDe(j).conCliente }} con datos del cliente)</p>
        </article>
      </div>

      <template v-if="jugadores.length">
        <h3 class="partida-juego__subtitulo">En el tiempo</h3>
        <div class="graficas">
          <GraficaLinea
            v-for="g in graficas"
            :key="g.titulo"
            :titulo="g.titulo"
            :unidad="g.unidad ?? ''"
            :limite="g.limite ?? null"
            :puntos="g.puntos"
            :series="seriesJugadores"
          />
        </div>
      </template>

      <template v-if="puntosServidor.length">
        <h3 class="partida-juego__subtitulo">El servidor en el tiempo</h3>
        <div class="graficas">
          <GraficaLinea
            v-for="g in graficasServidor"
            :key="g.titulo"
            :titulo="g.titulo"
            :unidad="g.unidad ?? ''"
            :limite="g.limite ?? null"
            :puntos="puntosServidor"
            :series="g.series"
          />
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.tirones {
  margin: 0 0 1rem;
}
.tirones table {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  border-collapse: collapse;
}
.tirones th,
.tirones td {
  padding: 0.2rem 0.6rem;
  text-align: left;
}

.partida-juego__volver {
  display: inline-block;
  margin-bottom: 12px;
  font-size: 0.9rem;
}

.partida-juego__error {
  color: var(--extremo);
}

.partida-juego__cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 14px;
}

.partida-juego__titulo {
  font-size: 1.5rem;
  margin: 0;
}

.partida-juego__subtitulo {
  margin: 28px 0 12px;
  font-size: 1.1rem;
}

.selector {
  display: flex;
  gap: 6px;
}

.servidor {
  font-size: 0.85rem;
  margin: 12px 0 16px;
}

.malo {
  color: var(--extremo);
}

.columnas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
  align-items: start;
}

.columna {
  padding: 14px 16px;
  border-top: 4px solid var(--ideal);
}

.columna--ojo {
  border-top-color: var(--calor);
}

.columna--malo {
  border-top-color: var(--extremo);
}

.columna__cabecera {
  display: flex;
  align-items: center;
  gap: 8px;
}

.columna__color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.columna__nombre {
  margin: 0;
  font-size: 1.1rem;
}

.columna__dispositivo {
  margin: 6px 0 0;
  font-size: 0.85rem;
}

.columna__ua {
  margin: 2px 0 0;
  font-size: 0.7rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banderas {
  list-style: none;
  padding: 0;
  margin: 12px 0;
  display: grid;
  gap: 6px;
}

.bandera {
  font-size: 0.85rem;
  padding: 6px 10px;
  border-radius: var(--radius);
  border-left: 3px solid;
}

.bandera--malo {
  border-left-color: var(--extremo);
  color: var(--extremo);
}

.bandera--ojo {
  border-left-color: var(--calor);
}

.bandera--bien {
  border-left-color: var(--ideal);
  color: var(--muted);
}

.numeros {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}

.numeros td {
  padding: 3px 0;
  border-bottom: 1px solid var(--border);
}

.numeros__valor {
  text-align: right;
  white-space: nowrap;
  padding-left: 8px;
}

.numeros__grupo th {
  text-align: left;
  padding: 12px 0 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.numeros__fila--mala td {
  color: var(--extremo);
  font-weight: 700;
}

.partida-juego__descargar {
  margin-left: auto;
}

.selector .btn:first-child {
  margin-left: 0;
}

.columna__subtitulo {
  margin: 14px 0 6px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.brincos {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 3px;
  font-size: 0.8rem;
}

.tramos {
  margin-bottom: 8px;
}

.tramos th {
  text-align: right;
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 600;
  padding-bottom: 4px;
}

.columna__muestras {
  font-size: 0.75rem;
  margin: 10px 0 0;
}

.graficas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
</style>
