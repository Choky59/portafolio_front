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
    { grupo: 'Bajada: estados del servidor (cliente)' },
    ['Recibidos', v(r.estadosPct, ' %'), (r.estadosPct ?? 100) < 90],
    [`Hueco p95 / máx. (esperado ${esperado} ms)`, `${v(r.huecoP95, ' ms')} / ${v(r.huecoMax, ' ms')}`, (r.huecoP95 ?? 0) > esperado * 2],
    ['Atraso p95', v(r.atraso, ' ms'), false],
    ['Colchón de los otros carros', v(r.colchonOtros, ' ms'), (r.colchonOtros ?? 0) > 150],
    ['Sin estado, de largo', v(r.deLargoPorS, ' /s'), (r.deLargoPorS ?? 0) > 1],
    { grupo: 'Ping y predicción (cliente)' },
    ['Ping p50 / p95 / p99', `${v(r.rttP50)} / ${v(r.rttP95)} / ${v(r.rttP99)} ms`, (r.rttP95 ?? 0) > 150],
    ['Confirmación de controles p95', v(r.confirmacionP95, ' ms'), false],
    ['Retraso de envío p95', v(r.envioP95, ' ms'), (r.envioP95 ?? 0) > 20],
    ['Correcciones', v(r.correccionesPorS, ' /s'), (r.correccionesPorS ?? 0) > 2],
    ['Error de choque p95', v(r.errorChoqueP95, ' m'), (r.errorChoqueP95 ?? 0) > 1],
    { grupo: 'Subida: sus controles (servidor)' },
    ['Controles que llegan', v(r.controlesPorS, ' /s'), false],
    ['Hueco p95 / máx.', `${v(r.controlesHuecoP95, ' ms')} / ${v(r.controlesHuecoMax, ' ms')}`, (r.controlesHuecoP95 ?? 0) > 50],
    ['Ticks sin control (hambre)', v(r.hambrePorS, ' /s'), (r.hambrePorS ?? 0) > 1],
    ['Tirados (cola llena)', v(r.tirados), (r.tirados ?? 0) > 0],
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
  { titulo: 'Ticks sin control (servidor)', unidad: ' /s', puntos: puntosDe((m) => Math.round((m.servidor.hambre / seg(m)) * 10) / 10) },
  { titulo: 'Correcciones', unidad: ' /s', puntos: puntosDe((m) => (m.cliente ? Math.round((m.cliente.correcciones / (m.cliente.ventanaMs / 1000)) * 10) / 10 : null)) },
  { titulo: 'Colchón de los otros carros', unidad: ' ms', puntos: puntosDe((m) => m.cliente?.colchonOtros ?? null) },
])

const presupuesto = computed(() => 1000 / (datos.value?.servidorActual?.tickHz ?? 60))
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
        <div v-if="enCurso" class="selector" role="group" aria-label="Periodo">
          <button type="button" class="btn btn--sm" :class="{ 'btn--ghost': vista !== 'ahora' }" @click="vista = 'ahora'">Últimos 30 s</button>
          <button type="button" class="btn btn--sm" :class="{ 'btn--ghost': vista !== 'total' }" @click="vista = 'total'">Toda la partida</button>
        </div>
      </div>

      <p class="servidor muted">
        <b>Servidor en esta partida:</b> tick p95 {{ datos.servidor.tickP95 }} ms (máx. {{ datos.servidor.tickMax }} ms) de
        {{ Math.round(presupuesto * 10) / 10 }} ms ·
        <span v-if="datos.servidor.banderas.length" class="malo">{{ datos.servidor.banderas[0].texto }}</span>
        <span v-else>va sobrado: no es el servidor</span>
      </p>

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
          <GraficaLinea
            titulo="Tick del servidor"
            unidad=" ms"
            :limite="presupuesto"
            :puntos="datos.servidor.muestras"
            :series="[{ clave: 'tickP95', nombre: 'p95', color: 'var(--accent)' }, { clave: 'tickMax', nombre: 'máx.', color: 'var(--calor)' }]"
          />
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
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
  margin-left: auto;
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
