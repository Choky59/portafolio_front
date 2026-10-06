<script setup>
/**
 * Dependency-free SVG line chart for the last N hours, with the four state bands behind it.
 * It measures its real width (ResizeObserver) and draws in real pixels, so the text keeps
 * a readable size on phones instead of shrinking with a fixed viewBox.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { config } from '../../config'

const props = defineProps({
  puntos: { type: Array, default: () => [] },
  horas: { type: Number, default: 24 },
})

const contenedor = ref(null)
const ancho = ref(600)
let observer = null

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    ancho.value = Math.max(260, Math.round(entry.contentRect.width))
  })
  observer.observe(contenedor.value)
})
onBeforeUnmount(() => observer?.disconnect())

const compacto = computed(() => ancho.value < 520)
const W = computed(() => ancho.value)
const H = computed(() => (compacto.value ? 200 : 240))
const M = { top: 10, right: 14, bottom: 26, left: 34 }

const datos = computed(() =>
  props.puntos.map((p) => ({ t: new Date(p.medidoEn).getTime(), v: p.temperatura, h: p.humedad ?? null }))
)

/** Vertical range follows the data (at least 8 °C tall) so a calm day isn't a flat line */
const rango = computed(() => {
  const fin = Date.now()
  const inicio = fin - props.horas * 3600 * 1000
  const valores = datos.value.map((d) => d.v)
  let min = valores.length ? Math.min(...valores) - 2 : 15
  let max = valores.length ? Math.max(...valores) + 2 : 40
  if (max - min < 8) {
    const centro = (max + min) / 2
    min = centro - 4
    max = centro + 4
  }
  const paso = max - min <= 14 ? 2 : 5
  return { inicio, fin, min: Math.floor(min / paso) * paso, max: Math.ceil(max / paso) * paso, paso }
})

const x = (t) => M.left + ((t - rango.value.inicio) / (rango.value.fin - rango.value.inicio)) * (W.value - M.left - M.right)
const y = (v) => M.top + (1 - (v - rango.value.min) / (rango.value.max - rango.value.min)) * (H.value - M.top - M.bottom)

const bandas = computed(() => {
  const { min, max } = rango.value
  return [
    { desde: -Infinity, hasta: 20, color: 'var(--frio)' },
    { desde: 20, hasta: 30, color: 'var(--ideal)' },
    { desde: 30, hasta: 35, color: 'var(--calor)' },
    { desde: 35, hasta: Infinity, color: 'var(--extremo)' },
  ]
    .filter((b) => b.hasta > min && b.desde < max)
    .map((b) => {
      const arriba = y(Math.min(b.hasta, max))
      const abajo = y(Math.max(b.desde, min))
      return { ...b, y: arriba, alto: abajo - arriba }
    })
})

const linea = computed(() => datos.value.map((d) => `${x(d.t).toFixed(1)},${y(d.v).toFixed(1)}`).join(' '))
const ultimo = computed(() => datos.value[datos.value.length - 1] ?? null)

const ticksY = computed(() => {
  const ticks = []
  for (let v = rango.value.min; v <= rango.value.max; v += rango.value.paso) ticks.push(v)
  return ticks
})

const formatoHora = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  hourCycle: 'h23',
  timeZone: config.zonaHoraria,
})

/** Whole hours, every 6 h on phones and every 3 h on wider screens */
const ticksX = computed(() => {
  const paso = (compacto.value ? 6 : 3) * 3600 * 1000
  const hora = 3600 * 1000
  const ultimoTick = Math.floor(rango.value.fin / hora) * hora
  const ticks = []
  for (let t = ultimoTick; t >= rango.value.inicio; t -= paso) {
    ticks.unshift({ t, texto: `${formatoHora.format(t)}:00` })
  }
  return ticks
})

/* ---------- Hover / touch / keyboard: show the value of the nearest point ---------- */

const svg = ref(null)
const activo = ref(null) // index in datos

const formatoMomento = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: config.zonaHoraria,
})

function masCercano(px) {
  let mejor = null
  let distancia = Infinity
  datos.value.forEach((d, i) => {
    const dx = Math.abs(x(d.t) - px)
    if (dx < distancia) {
      distancia = dx
      mejor = i
    }
  })
  return mejor
}

function onPointer(e) {
  if (!datos.value.length || !svg.value) return
  const px = e.clientX - svg.value.getBoundingClientRect().left
  // Only inside the plot area
  if (px < M.left - 8 || px > W.value - M.right + 8) {
    activo.value = null
    return
  }
  activo.value = masCercano(px)
}

function onTeclado(e) {
  const n = datos.value.length
  if (!n) return
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    const paso = e.key === 'ArrowLeft' ? -1 : 1
    activo.value = activo.value === null ? n - 1 : Math.min(n - 1, Math.max(0, activo.value + paso))
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault()
    activo.value = e.key === 'Home' ? 0 : n - 1
  } else if (e.key === 'Escape') {
    activo.value = null
  }
}

const seleccion = computed(() => {
  const d = activo.value === null ? null : datos.value[activo.value]
  if (!d) return null
  const px = x(d.t)
  const py = y(d.v)
  return {
    px,
    py,
    temperatura: `${d.v.toFixed(1)} °C`,
    humedad: d.h === null ? null : `${Math.round(d.h)}% humedad`,
    hora: formatoMomento.format(d.t),
    // Keep the tooltip inside the chart horizontally; flip below the point near the top
    left: Math.min(Math.max(px, 70), W.value - 70),
    abajo: py < 70,
  }
})

const resumen = computed(() => {
  if (!datos.value.length) return 'Sin datos todavía.'
  const valores = datos.value.map((d) => d.v)
  return `Últimas ${props.horas} horas: mínima ${Math.min(...valores)} °C, máxima ${Math.max(...valores)} °C.`
})
</script>

<template>
  <figure ref="contenedor" class="grafica">
    <div class="grafica__area">
      <svg
        ref="svg"
        :width="W"
        :height="H"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        :aria-label="`${resumen} Usa las flechas para recorrer los valores.`"
        :tabindex="datos.length ? 0 : undefined"
        @pointermove="onPointer"
        @pointerdown="onPointer"
        @pointerleave="activo = null"
        @keydown="onTeclado"
        @blur="activo = null"
      >
        <rect
          v-for="b in bandas"
          :key="b.color"
          :x="M.left"
          :y="b.y"
          :width="W - M.left - M.right"
          :height="b.alto"
          :fill="b.color"
          opacity="0.16"
        />

        <g class="grafica__eje">
          <g v-for="v in ticksY" :key="v">
            <line :x1="M.left" :x2="W - M.right" :y1="y(v)" :y2="y(v)" />
            <text :x="M.left - 6" :y="y(v) + 4" text-anchor="end">{{ v }}°</text>
          </g>
          <text v-for="tick in ticksX" :key="tick.t" :x="x(tick.t)" :y="H - 6" text-anchor="middle">
            {{ tick.texto }}
          </text>
        </g>

        <polyline v-if="datos.length > 1" :points="linea" class="grafica__linea" />
        <template v-if="ultimo">
          <circle :cx="x(ultimo.t)" :cy="y(ultimo.v)" r="5" class="grafica__punto" />
          <text
            v-if="!seleccion"
            :x="x(ultimo.t) - 8"
            :y="y(ultimo.v) - 10"
            text-anchor="end"
            class="grafica__valor"
          >{{ ultimo.v }}°</text>
        </template>

        <!-- Hovered / selected point -->
        <g v-if="seleccion" class="grafica__seleccion">
          <line :x1="seleccion.px" :x2="seleccion.px" :y1="M.top" :y2="H - M.bottom" />
          <circle :cx="seleccion.px" :cy="seleccion.py" r="6" />
        </g>
      </svg>

      <div
        v-if="seleccion"
        class="grafica__tooltip"
        :class="{ 'grafica__tooltip--abajo': seleccion.abajo }"
        :style="{ left: `${seleccion.left}px`, top: `${seleccion.py}px` }"
        aria-hidden="true"
      >
        <strong>{{ seleccion.temperatura }}</strong>
        <span v-if="seleccion.humedad">{{ seleccion.humedad }}</span>
        <span class="grafica__tooltip-hora">{{ seleccion.hora }}</span>
      </div>
    </div>

    <!-- Screen readers hear the selected value when moving with the arrow keys -->
    <p class="visually-hidden" aria-live="polite">
      {{ seleccion ? `${seleccion.hora}: ${seleccion.temperatura}${seleccion.humedad ? `, ${seleccion.humedad}` : ''}` : '' }}
    </p>
    <figcaption class="muted">{{ resumen }} Promedio cada 10 minutos, hora de Hermosillo.</figcaption>
  </figure>
</template>

<style scoped>
.grafica {
  margin: 0;
  width: 100%;
}

.grafica__area {
  position: relative;
}

svg {
  display: block;
  max-width: 100%;
  overflow: visible;
  cursor: crosshair;
  /* Horizontal drag explores the chart; vertical swipes still scroll the page */
  touch-action: pan-y;
}

svg:focus-visible {
  outline-offset: 4px;
}

.grafica__seleccion line {
  stroke: var(--text);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  opacity: 0.7;
}

.grafica__seleccion circle {
  fill: var(--accent);
  stroke: var(--bg);
  stroke-width: 2.5;
}

.grafica__tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 12px));
  display: grid;
  gap: 1px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  font-size: 0.8rem;
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
}

.grafica__tooltip--abajo {
  transform: translate(-50%, 12px);
}

.grafica__tooltip strong {
  font-size: 1rem;
}

.grafica__tooltip-hora {
  color: var(--muted);
}

.grafica__eje line {
  stroke: var(--border);
  stroke-width: 1;
}

.grafica__eje text {
  fill: var(--muted);
  font-size: 12px;
  font-family: var(--font-body);
}

.grafica__linea {
  fill: none;
  stroke: var(--text);
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.grafica__punto {
  fill: var(--accent);
  stroke: var(--bg);
  stroke-width: 2;
}

.grafica__valor {
  fill: var(--text);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-body);
}

figcaption {
  font-size: 0.85rem;
  margin-top: 6px;
}
</style>
