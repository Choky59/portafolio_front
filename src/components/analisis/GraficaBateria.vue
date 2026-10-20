<script setup>
/** Sensor battery (%) over time, hourly averages, with the low-battery zone (< 30%) marked */
import { computed } from 'vue'
import { useGraficaInteractiva } from '../../composables/useGraficaInteractiva'
import { config } from '../../config'

const props = defineProps({
  puntos: { type: Array, required: true }, // [{ hora, porcentaje, voltaje }]
})

const BAJA = 30 // same as the backend (BATERIA_BAJA_PCT)
const M = { top: 12, right: 14, bottom: 26, left: 38 }

const datos = computed(() => props.puntos.map((p) => ({ ...p, t: new Date(p.hora).getTime() })))

const { contenedor, svg, ancho, activo, onPointer, onTeclado, salir } = useGraficaInteractiva({
  cantidad: () => datos.value.length,
  posicionX: (i) => x(datos.value[i].t),
  margen: M,
})

const W = computed(() => ancho.value)
const H = computed(() => (ancho.value < 520 ? 180 : 210))

const inicio = computed(() => datos.value[0]?.t ?? Date.now())
const fin = computed(() => Math.max(datos.value[datos.value.length - 1]?.t ?? Date.now(), inicio.value + 3600000))
const x = (t) => M.left + ((t - inicio.value) / (fin.value - inicio.value)) * (W.value - M.left - M.right)
const y = (v) => M.top + (1 - v / 100) * (H.value - M.top - M.bottom)

const linea = computed(() => datos.value.map((d) => `${x(d.t).toFixed(1)},${y(d.porcentaje).toFixed(1)}`).join(' '))

const fmtDia = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: config.zonaHoraria })
const fmtMomento = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: config.zonaHoraria,
})

/** ~5 evenly spaced date labels */
const ticksX = computed(() => {
  const n = ancho.value < 520 ? 3 : 5
  return Array.from({ length: n }, (_, i) => {
    const t = inicio.value + ((fin.value - inicio.value) * i) / (n - 1)
    return { t, texto: fmtDia.format(t) }
  })
})

const seleccion = computed(() => {
  const d = activo.value === null ? null : datos.value[activo.value]
  if (!d) return null
  const px = x(d.t)
  const py = y(d.porcentaje)
  return { ...d, px, py, left: Math.min(Math.max(px, 70), W.value - 70), abajo: py < 80, momento: fmtMomento.format(d.t) }
})

const resumen = computed(() => {
  if (!datos.value.length) return 'Sin datos de batería.'
  const primero = datos.value[0]
  const ultimo = datos.value[datos.value.length - 1]
  return `La batería pasó de ${primero.porcentaje}% a ${ultimo.porcentaje}% entre el ${fmtDia.format(primero.t)} y el ${fmtDia.format(ultimo.t)}.`
})
</script>

<template>
  <figure ref="contenedor" class="graf">
    <div class="graf__area">
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
        @pointerleave="salir"
        @keydown="onTeclado"
        @blur="salir"
      >
        <!-- Low-battery zone -->
        <rect :x="M.left" :y="y(BAJA)" :width="W - M.left - M.right" :height="y(0) - y(BAJA)" class="bat__baja" />

        <g class="graf__eje">
          <g v-for="v in [0, 25, 50, 75, 100]" :key="v">
            <line :x1="M.left" :x2="W - M.right" :y1="y(v)" :y2="y(v)" />
            <text :x="M.left - 6" :y="y(v) + 4" text-anchor="end">{{ v }}%</text>
          </g>
          <text v-for="tick in ticksX" :key="tick.t" :x="x(tick.t)" :y="H - 6" text-anchor="middle">{{ tick.texto }}</text>
        </g>

        <polyline v-if="datos.length > 1" :points="linea" class="bat__linea" />

        <g v-if="seleccion">
          <line class="graf__guia" :x1="seleccion.px" :x2="seleccion.px" :y1="M.top" :y2="H - M.bottom" />
          <circle :cx="seleccion.px" :cy="seleccion.py" r="6" class="bat__punto" />
        </g>
      </svg>

      <div
        v-if="seleccion"
        class="graf__tooltip"
        :class="{ 'graf__tooltip--abajo': seleccion.abajo }"
        :style="{ left: `${seleccion.left}px`, top: `${seleccion.py}px` }"
        aria-hidden="true"
      >
        <strong>{{ seleccion.porcentaje }}%</strong>
        <span v-if="seleccion.voltaje != null">{{ seleccion.voltaje.toFixed(2) }} V</span>
        <span class="muted">{{ seleccion.momento }}</span>
      </div>
    </div>

    <p class="visually-hidden" aria-live="polite">
      {{ seleccion ? `${seleccion.momento}: ${seleccion.porcentaje}%` : '' }}
    </p>
    <figcaption>{{ resumen }} La franja roja marca la batería baja (menos de {{ BAJA }}%).</figcaption>
  </figure>
</template>

<style scoped>
.bat__baja {
  fill: var(--extremo);
  opacity: 0.12;
}

.bat__linea {
  fill: none;
  stroke: var(--ideal);
  stroke-width: 2.5;
  stroke-linejoin: round;
}

.bat__punto {
  fill: var(--ideal);
  stroke: var(--bg);
  stroke-width: 2.5;
}
</style>
