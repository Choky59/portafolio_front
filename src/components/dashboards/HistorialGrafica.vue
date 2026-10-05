<script setup>
/**
 * Dependency-free SVG line chart for the last N hours,
 * with the four state bands behind the line.
 */
import { computed } from 'vue'
import { config } from '../../config'

const props = defineProps({
  puntos: { type: Array, default: () => [] },
  horas: { type: Number, default: 24 },
})

const W = 600
const H = 220
const M = { top: 12, right: 12, bottom: 28, left: 36 }

const datos = computed(() =>
  props.puntos.map((p) => ({ t: new Date(p.medidoEn).getTime(), v: p.temperatura }))
)

const rango = computed(() => {
  const fin = Date.now()
  const inicio = fin - props.horas * 3600 * 1000
  const valores = datos.value.map((d) => d.v)
  const min = Math.floor(Math.min(15, ...valores) / 5) * 5
  const max = Math.ceil(Math.max(40, ...valores) / 5) * 5
  return { inicio, fin, min, max }
})

const x = (t) => M.left + ((t - rango.value.inicio) / (rango.value.fin - rango.value.inicio)) * (W - M.left - M.right)
const y = (v) => M.top + (1 - (v - rango.value.min) / (rango.value.max - rango.value.min)) * (H - M.top - M.bottom)

const bandas = computed(() => {
  const { min, max } = rango.value
  const cortes = [
    { desde: min, hasta: 20, color: 'var(--frio)' },
    { desde: 20, hasta: 30, color: 'var(--ideal)' },
    { desde: 30, hasta: 35, color: 'var(--calor)' },
    { desde: 35, hasta: max, color: 'var(--extremo)' },
  ]
  return cortes
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
  for (let v = rango.value.min; v <= rango.value.max; v += 5) ticks.push(v)
  return ticks
})

const formatoHora = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: config.zonaHoraria,
})

const ticksX = computed(() => {
  const paso = props.horas <= 24 ? 6 : 12
  const ticks = []
  for (let h = props.horas; h >= 0; h -= paso) {
    const t = rango.value.fin - h * 3600 * 1000
    ticks.push({ t, texto: formatoHora.format(t) })
  }
  return ticks
})

const resumen = computed(() => {
  if (!datos.value.length) return 'Sin datos todavía.'
  const valores = datos.value.map((d) => d.v)
  return `Últimas ${props.horas} horas: mínima ${Math.min(...valores)} °C, máxima ${Math.max(...valores)} °C.`
})
</script>

<template>
  <figure class="grafica">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="resumen">
      <rect
        v-for="b in bandas"
        :key="b.desde"
        :x="M.left"
        :y="b.y"
        :width="W - M.left - M.right"
        :height="b.alto"
        :fill="b.color"
        opacity="0.14"
      />

      <g class="grafica__eje">
        <g v-for="v in ticksY" :key="v">
          <line :x1="M.left" :x2="W - M.right" :y1="y(v)" :y2="y(v)" />
          <text :x="M.left - 6" :y="y(v) + 4" text-anchor="end">{{ v }}°</text>
        </g>
        <text v-for="tick in ticksX" :key="tick.t" :x="x(tick.t)" :y="H - 8" text-anchor="middle">
          {{ tick.texto }}
        </text>
      </g>

      <polyline v-if="datos.length > 1" :points="linea" class="grafica__linea" />
      <circle v-if="ultimo" :cx="x(ultimo.t)" :cy="y(ultimo.v)" r="5" class="grafica__punto" />
    </svg>
    <figcaption class="muted">
      {{ resumen }} Promedio cada 10 minutos, hora de Hermosillo.
    </figcaption>
  </figure>
</template>

<style scoped>
.grafica {
  margin: 0;
}

svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.grafica__eje line {
  stroke: var(--border);
  stroke-width: 1;
}

.grafica__eje text {
  fill: var(--muted);
  font-size: 11px;
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

figcaption {
  font-size: 0.85rem;
  margin-top: 6px;
}
</style>
