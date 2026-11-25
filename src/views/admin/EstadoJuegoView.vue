<script setup>
/**
 * STATUS: the performance of the Edge Racers game server while people play (GET /api/juego/status).
 * Live: the rooms the server simulates, what each tick costs, the ticks it's behind and every
 * player's ping; and the last hour (one sample every 5 s, kept in the server's memory).
 * Refreshes every 3 s while the tab is visible.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getEstadoJuego } from '../../api/admin'
import { mensajeError } from '../../api/client'
import GraficaLinea from './GraficaLinea.vue'

const CADA_MS = 3000
const PING_ALTO = 150

const datos = ref(null)
const error = ref(null)
const actualizado = ref(null)
let reloj = null
let pedido = null

async function cargar() {
  if (document.hidden) return
  pedido?.abort()
  pedido = new AbortController()
  try {
    datos.value = await getEstadoJuego(pedido.signal)
    error.value = null
    actualizado.value = new Date()
  } catch (err) {
    if (err?.name !== 'AbortError') error.value = err
  }
}

function alCambiarVisibilidad() {
  if (!document.hidden) cargar()
}

onMounted(() => {
  cargar()
  reloj = setInterval(cargar, CADA_MS)
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
})

onBeforeUnmount(() => {
  clearInterval(reloj)
  pedido?.abort()
  document.removeEventListener('visibilitychange', alCambiarVisibilidad)
})

const vivo = computed(() => datos.value?.vivo ?? null)
const historial = computed(() => datos.value?.historial ?? [])
const ultima = computed(() => vivo.value?.ultima ?? null)
/** What one tick may cost: at 60 Hz, 16.7 ms. Past half of it the server is in trouble */
const presupuesto = computed(() => (vivo.value ? 1000 / vivo.value.tickHz : 16.7))
const salas = computed(() =>
  [...(vivo.value?.salas ?? [])].sort((a, b) => Number(b.simulada) - Number(a.simulada) || b.personas - a.personas),
)

const ms = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100) / 100} ms`)

function duracion(segundos) {
  if (!segundos && segundos !== 0) return '—'
  const d = Math.floor(segundos / 86400)
  const h = Math.floor((segundos % 86400) / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`
}

const tarjetas = computed(() => {
  const v = vivo.value
  const u = ultima.value
  if (!v) return []
  return [
    { nombre: 'Salas simuladas', valor: `${salas.value.filter((s) => s.simulada).length} / ${salas.value.length}` },
    { nombre: 'Jugando', valor: `${salas.value.reduce((n, s) => n + s.personas, 0)} personas`, detalle: `${salas.value.reduce((n, s) => n + s.bots, 0)} bots · ${v.sockets} conexiones` },
    { nombre: 'Tick p95 (peor sala)', valor: ms(u?.tickP95), malo: (u?.tickP95 ?? 0) > presupuesto.value / 2, detalle: `presupuesto ${ms(presupuesto.value)} (${v.tickHz} Hz)` },
    { nombre: 'Ticks atrasados', valor: u ? String(u.pendientes) : '—', malo: (u?.pendientes ?? 0) > 0 },
    { nombre: 'Event loop p95', valor: ms(u?.bucleP95), malo: (u?.bucleP95 ?? 0) > 20, detalle: u ? `máx. ${ms(u.bucleMax)}` : '' },
    { nombre: 'CPU', valor: u ? `${u.cpu} %` : '—', malo: (u?.cpu ?? 0) > 80, detalle: 'de un núcleo' },
    { nombre: 'Memoria', valor: `${v.rssMb} MB`, detalle: `heap ${v.heapMb} MB` },
    { nombre: 'Ping p50 / p95', valor: u?.pingP50 != null ? `${u.pingP50} / ${u.pingP95} ms` : '—', malo: (u?.pingP95 ?? 0) > PING_ALTO },
    { nombre: 'Encendido', valor: duracion(v.uptime), detalle: `${v.node} · ${datos.value.origen === 'local' ? 'este servidor' : 'VM del juego'}` },
  ]
})

const COLOR_A = 'var(--accent)'
const COLOR_B = 'var(--calor)'
</script>

<template>
  <section class="estado-juego">
    <div class="estado-juego__cabecera">
      <h2 class="estado-juego__titulo">Status · Edge Racers</h2>
      <p class="muted">
        <template v-if="actualizado">Actualizado {{ actualizado.toLocaleTimeString() }} · cada {{ CADA_MS / 1000 }} s</template>
        <template v-else>Cargando…</template>
      </p>
    </div>

    <p v-if="error" class="estado-juego__error" role="alert">{{ mensajeError(error) }}</p>

    <template v-if="vivo">
      <ul class="tarjetas">
        <li v-for="t in tarjetas" :key="t.nombre" class="tarjeta card" :class="{ 'tarjeta--mala': t.malo }">
          <span class="tarjeta__nombre muted">{{ t.nombre }}</span>
          <span class="tarjeta__valor">{{ t.valor }}</span>
          <span v-if="t.detalle" class="tarjeta__detalle muted">{{ t.detalle }}</span>
        </li>
      </ul>

      <h3 class="estado-juego__subtitulo">Salas ahora</h3>
      <p v-if="!salas.length" class="muted">No hay salas abiertas.</p>
      <div v-else class="tabla-envoltura card">
        <table class="tabla">
          <thead>
            <tr>
              <th>Sala</th>
              <th>Tipo</th>
              <th>Circuito</th>
              <th>Fase</th>
              <th>Jugadores</th>
              <th>Tick p50 / p95 / p99 / máx.</th>
              <th>Atrasados</th>
              <th>Cola</th>
              <th>Ping</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in salas" :key="s.codigo" :class="{ 'tabla__fila--apagada': !s.simulada }">
              <td class="tabla__codigo">{{ s.codigo }}</td>
              <td>{{ s.tipo }}<span v-if="!s.simulada" class="muted"> (navegador)</span></td>
              <td>{{ s.circuito }}</td>
              <td>{{ s.fase }}</td>
              <td>{{ s.personas }}<span class="muted"> + {{ s.bots }} bots<template v-if="s.espectadores"> · {{ s.espectadores }} viendo</template></span></td>
              <td>
                <template v-if="s.tick?.n">
                  {{ s.tick.p50 }} / <b :class="{ malo: s.tick.p95 > presupuesto / 2 }">{{ s.tick.p95 }}</b> / {{ s.tick.p99 }} /
                  <span :class="{ malo: s.tick.max > presupuesto }">{{ s.tick.max }}</span> ms
                </template>
                <span v-else class="muted">—</span>
              </td>
              <td :class="{ malo: s.pendientes > 0 }">{{ s.pendientes }}</td>
              <td>{{ s.cola }}</td>
              <td>
                <span v-for="(p, i) in s.pings" :key="i" class="ping" :class="{ malo: p.ping > PING_ALTO }" :title="p.color">
                  <span class="ping__color" :data-color="p.color"></span>{{ p.ping ?? '—' }}<template v-if="p.ping !== null"> ms</template>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 class="estado-juego__subtitulo">Última hora</h3>
      <div class="graficas">
        <GraficaLinea
          titulo="Tick (peor sala)"
          unidad=" ms"
          :limite="presupuesto"
          :puntos="historial"
          :series="[{ clave: 'tickP95', nombre: 'p95', color: COLOR_A }, { clave: 'tickMax', nombre: 'máx.', color: COLOR_B }]"
        />
        <GraficaLinea
          titulo="Event loop"
          unidad=" ms"
          :puntos="historial"
          :series="[{ clave: 'bucleP95', nombre: 'p95', color: COLOR_A }, { clave: 'bucleMax', nombre: 'máx.', color: COLOR_B }]"
        />
        <GraficaLinea titulo="CPU" unidad=" %" :puntos="historial" :series="[{ clave: 'cpu', nombre: 'CPU', color: COLOR_A }]" />
        <GraficaLinea
          titulo="Memoria"
          unidad=" MB"
          :puntos="historial"
          :series="[{ clave: 'rssMb', nombre: 'RSS', color: COLOR_A }, { clave: 'heapMb', nombre: 'heap', color: COLOR_B }]"
        />
        <GraficaLinea
          titulo="Gente"
          :puntos="historial"
          :series="[{ clave: 'personas', nombre: 'personas', color: COLOR_A }, { clave: 'simuladas', nombre: 'salas', color: COLOR_B }]"
        />
        <GraficaLinea
          titulo="Ping de los jugadores"
          unidad=" ms"
          :limite="PING_ALTO"
          :puntos="historial"
          :series="[{ clave: 'pingP50', nombre: 'p50', color: COLOR_A }, { clave: 'pingP95', nombre: 'p95', color: COLOR_B }]"
        />
      </div>
      <p class="muted estado-juego__nota">
        El historial vive en la memoria del servidor del juego: se borra cuando se reinicia. El ping lo reporta cada
        cliente; las versiones viejas del juego salen como “—”.
      </p>
    </template>
  </section>
</template>

<style scoped>
.estado-juego__cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
}

.estado-juego__titulo {
  font-size: 1.5rem;
  margin: 0;
}

.estado-juego__subtitulo {
  margin: 28px 0 12px;
  font-size: 1.1rem;
}

.estado-juego__error {
  color: var(--extremo);
}

.estado-juego__nota {
  font-size: 0.8rem;
  margin-top: 12px;
}

.tarjetas {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}

.tarjeta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border-left: 3px solid transparent;
}

.tarjeta--mala {
  border-left-color: var(--extremo);
}

.tarjeta--mala .tarjeta__valor {
  color: var(--extremo);
}

.tarjeta__nombre,
.tarjeta__detalle {
  font-size: 0.78rem;
}

.tarjeta__valor {
  font-size: 1.35rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.tabla-envoltura {
  overflow-x: auto;
  padding: 0;
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.tabla th,
.tabla td {
  padding: 8px 12px;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
}

.tabla th {
  color: var(--muted);
  font-weight: 600;
}

.tabla tbody tr:last-child td {
  border-bottom: 0;
}

.tabla__codigo {
  font-weight: 600;
}

.tabla__fila--apagada {
  opacity: 0.6;
}

.malo {
  color: var(--extremo);
  font-weight: 700;
}

.ping {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 10px;
}

.ping__color {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--muted);
}

.ping__color[data-color='rojo'] { background: #e4572e; }
.ping__color[data-color='azul'] { background: #4f8fe8; }
.ping__color[data-color='amarillo'] { background: #f6c445; }
.ping__color[data-color='verde'] { background: #7fb7a4; }
.ping__color[data-color='morado'] { background: #9c6ade; }
.ping__color[data-color='rosa'] { background: #f07fb0; }

.graficas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
</style>
