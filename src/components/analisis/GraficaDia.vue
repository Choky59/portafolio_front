<script setup>
/**
 * Temperature of one calendar day (06:00 → 05:59), every 10 minutes, with the state
 * bands behind it and the morning / afternoon / night boundaries marked.
 * Days already seen are kept for a few minutes, so going back and forth is instant.
 */
import { computed, watch } from 'vue'
import { useApi } from '../../composables/useApi'
import { useGraficaInteractiva } from '../../composables/useGraficaInteractiva'
import { getDia } from '../../api/sePuedeSalir'
import { config } from '../../config'
import { bandasEnRango, grados, rangoTemperatura } from './escala'

const props = defineProps({
  fecha: { type: String, required: true }, // yyyy-mm-dd
})

const HORA = 3600 * 1000
const HUECO = 30 * 60 * 1000 // more than this without readings = sensor off, the line breaks
const M = { top: 22, right: 14, bottom: 26, left: 34 }

/* Module-level: the same day isn't requested twice within 5 minutes */
const cache = new Map()
function pedirDia(fecha, signal) {
  const guardado = cache.get(fecha)
  if (guardado && Date.now() - guardado.en < 5 * 60 * 1000) return guardado.datos
  const datos = getDia(fecha, signal)
  cache.set(fecha, { en: Date.now(), datos })
  // A failed or aborted request must not stay cached
  datos.catch(() => cache.delete(fecha))
  return datos
}

const { data, error, loading, reload } = useApi((signal) => pedirDia(props.fecha, signal), { immediate: false })
watch(() => props.fecha, reload, { immediate: true })

const datos = computed(() => (data.value?.puntos ?? []).map((p) => ({ ...p, t: new Date(p.medidoEn).getTime() })))

// Single lowest / highest reading of each 10-min bucket (older API answers only had the average)
const bajo = (d) => d.min ?? d.temperatura
const alto = (d) => d.max ?? d.temperatura

const { contenedor, svg, ancho, activo, onPointer, onTeclado, salir } = useGraficaInteractiva({
  cantidad: () => datos.value.length,
  posicionX: (i) => x(datos.value[i].t),
  margen: M,
})

const compacto = computed(() => ancho.value < 520)
const W = computed(() => ancho.value)
const H = computed(() => (compacto.value ? 200 : 230))

const inicio = computed(() => (data.value ? new Date(data.value.desde).getTime() : 0))
const fin = computed(() => (data.value ? new Date(data.value.hasta).getTime() : HORA))
const escala = computed(() => rangoTemperatura(datos.value.flatMap((d) => [bajo(d), alto(d)])))

const x = (t) => M.left + ((t - inicio.value) / (fin.value - inicio.value)) * (W.value - M.left - M.right)
const y = (v) => M.top + (1 - (v - escala.value.min) / (escala.value.max - escala.value.min)) * (H.value - M.top - M.bottom)

const bandas = computed(() => bandasEnRango(escala.value.min, escala.value.max, y))

/** Runs of buckets without gaps, so an offline sensor doesn't draw a fake line */
const tramos = computed(() => {
  const lista = []
  datos.value.forEach((d, i) => {
    if (i === 0 || d.t - datos.value[i - 1].t > HUECO) lista.push([])
    lista[lista.length - 1].push(d)
  })
  return lista
})

const punto = (d, v) => `${x(d.t).toFixed(1)},${y(v).toFixed(1)}`
const linea = computed(() => tramos.value.map((t) => `M${t.map((d) => punto(d, d.temperatura)).join(' L')}`).join(' '))
// Band per run: along the highs going right, back along the lows going left
const banda = computed(() =>
  tramos.value
    .map((t) => `M${[...t.map((d) => punto(d, alto(d))), ...[...t].reverse().map((d) => punto(d, bajo(d)))].join(' L')}Z`)
    .join(' ')
)

const fmtHora = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: config.zonaHoraria,
})

/** Every 3 h (6 h on phones) from 06:00 */
const ticksX = computed(() => {
  const paso = (compacto.value ? 6 : 3) * HORA
  const ticks = []
  for (let t = inicio.value; t <= fin.value; t += paso) ticks.push({ t, texto: fmtHora.format(t) })
  return ticks
})

/* Hours after 06:00: morning 06–12, afternoon 12–19, night 19–06 (same as the calendar detail) */
const franjas = computed(() =>
  [
    { nombre: 'Mañana', desde: 0, hasta: 6 },
    { nombre: 'Tarde', desde: 6, hasta: 13 },
    { nombre: 'Noche', desde: 13, hasta: 24 },
  ].map((f) => ({ ...f, x1: x(inicio.value + f.desde * HORA), x2: x(inicio.value + f.hasta * HORA) }))
)

/* Real extremes of the day (single readings), matching the "Todo el día" line above */
const extremos = computed(() => {
  if (!datos.value.length) return null
  const max = datos.value.reduce((a, b) => (alto(b) > alto(a) ? b : a))
  const min = datos.value.reduce((a, b) => (bajo(b) < bajo(a) ? b : a))
  return { max: { t: max.t, v: alto(max) }, min: { t: min.t, v: bajo(min) } }
})

const seleccion = computed(() => {
  const d = activo.value === null ? null : datos.value[activo.value]
  if (!d) return null
  const px = x(d.t)
  const py = y(d.temperatura)
  return { ...d, px, py, left: Math.min(Math.max(px, 70), W.value - 70), abajo: py < 80, hora: fmtHora.format(d.t) }
})

const resumen = computed(() => {
  const e = extremos.value
  if (!e) return 'Sin lecturas este día.'
  return `Máxima ${grados(e.max.v)} cerca de las ${fmtHora.format(e.max.t)}, mínima ${grados(e.min.v)} cerca de las ${fmtHora.format(e.min.t)}.`
})
</script>

<template>
  <figure ref="contenedor" class="graf dia" :class="{ 'dia--cargando': loading && data }" :aria-busy="loading">
    <p v-if="error" class="muted dia__aviso">
      No se pudo cargar la gráfica del día.
      <button type="button" class="dia__reintentar" @click="reload">Reintentar</button>
    </p>
    <p v-else-if="!data" class="muted dia__aviso" role="status">Cargando la gráfica del día…</p>
    <p v-else-if="!datos.length" class="muted dia__aviso">Sin lecturas este día.</p>

    <template v-else>
      <div class="graf__area">
        <svg
          ref="svg"
          :width="W"
          :height="H"
          :viewBox="`0 0 ${W} ${H}`"
          role="img"
          :aria-label="`${resumen} Usa las flechas para recorrer el día.`"
          tabindex="0"
          @pointermove="onPointer"
          @pointerdown="onPointer"
          @pointerleave="salir"
          @keydown="onTeclado"
          @blur="salir"
        >
          <rect
            v-for="b in bandas"
            :key="b.clave"
            :x="M.left"
            :y="b.y"
            :width="W - M.left - M.right"
            :height="b.alto"
            :fill="b.color"
            opacity="0.14"
          />

          <g class="graf__eje">
            <g v-for="v in escala.ticks" :key="v">
              <line :x1="M.left" :x2="W - M.right" :y1="y(v)" :y2="y(v)" />
              <text :x="M.left - 6" :y="y(v) + 4" text-anchor="end">{{ v }}°</text>
            </g>
            <text v-for="tick in ticksX" :key="tick.t" :x="x(tick.t)" :y="H - 6" text-anchor="middle">{{ tick.texto }}</text>
          </g>

          <!-- Morning / afternoon / night -->
          <g class="dia__franjas">
            <line v-for="f in franjas.slice(1)" :key="f.nombre" :x1="f.x1" :x2="f.x1" :y1="M.top - 16" :y2="H - M.bottom" />
            <text v-for="f in franjas" :key="f.nombre" :x="(f.x1 + f.x2) / 2" :y="M.top - 8" text-anchor="middle">{{ f.nombre }}</text>
          </g>

          <path :d="banda" class="dia__banda" />
          <path :d="linea" class="dia__linea" />

          <g v-if="extremos && !seleccion" class="dia__extremos">
            <circle :cx="x(extremos.max.t)" :cy="y(extremos.max.v)" r="4.5" class="dia__max" />
            <circle :cx="x(extremos.min.t)" :cy="y(extremos.min.v)" r="4.5" class="dia__min" />
          </g>

          <g v-if="seleccion">
            <line class="graf__guia" :x1="seleccion.px" :x2="seleccion.px" :y1="M.top" :y2="H - M.bottom" />
            <circle :cx="seleccion.px" :cy="seleccion.py" r="6" class="dia__punto" />
          </g>
        </svg>

        <div
          v-if="seleccion"
          class="graf__tooltip"
          :class="{ 'graf__tooltip--abajo': seleccion.abajo }"
          :style="{ left: `${seleccion.left}px`, top: `${seleccion.py}px` }"
          aria-hidden="true"
        >
          <strong>{{ grados(seleccion.temperatura) }}</strong>
          <span v-if="alto(seleccion) - bajo(seleccion) >= 0.5">{{ grados(bajo(seleccion)) }} a {{ grados(alto(seleccion)) }}</span>
          <span v-if="seleccion.humedad != null">{{ seleccion.humedad }}% humedad</span>
          <span class="muted">{{ seleccion.hora }}</span>
        </div>
      </div>

      <p class="visually-hidden" aria-live="polite">
        {{ seleccion ? `${seleccion.hora}: ${grados(seleccion.temperatura)}` : '' }}
      </p>
      <figcaption>
        {{ resumen }}
        <span class="dia__clave dia__clave--max" aria-hidden="true" /> máxima ·
        <span class="dia__clave dia__clave--min" aria-hidden="true" /> mínima. La línea es el promedio cada 10 minutos;
        la franja sombreada, la lectura más baja y más alta de esos 10 minutos.
      </figcaption>
    </template>
  </figure>
</template>

<style scoped>
.dia {
  transition: opacity 0.15s;
}

.dia--cargando {
  opacity: 0.5;
}

.dia__aviso {
  margin: 0;
  padding: 24px 0;
  text-align: center;
}

.dia__reintentar {
  font: inherit;
  color: var(--accent);
  background: none;
  border: 0;
  padding: 0;
  text-decoration: underline;
  cursor: pointer;
}

.dia__franjas line {
  stroke: var(--muted);
  stroke-width: 1;
  stroke-dasharray: 2 4;
}

.dia__franjas text {
  fill: var(--muted);
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-body);
}

.dia__banda {
  fill: var(--text);
  opacity: 0.14;
}

.dia__linea {
  fill: none;
  stroke: var(--text);
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.dia__punto {
  fill: var(--accent);
  stroke: var(--bg);
  stroke-width: 2.5;
}

.dia__extremos circle {
  stroke: var(--bg);
  stroke-width: 2;
}

.dia__max {
  fill: var(--extremo);
}

.dia__min {
  fill: var(--frio);
}

.dia__clave {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  vertical-align: middle;
}

.dia__clave--max {
  background: var(--extremo);
}

.dia__clave--min {
  background: var(--frio);
}
</style>
