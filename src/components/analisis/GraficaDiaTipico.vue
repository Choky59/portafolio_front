<script setup>
/**
 * The typical day: average temperature for each local hour (0–23 h) over the whole
 * period, with the min–max band shaded and the state bands behind it.
 */
import { computed } from 'vue'
import { useGraficaInteractiva } from '../../composables/useGraficaInteractiva'
import { bandasEnRango, grados, rangoTemperatura } from './escala'

const props = defineProps({
  horas: { type: Array, required: true }, // [{ hora, promedio, min, max }]
})

const M = { top: 12, right: 14, bottom: 26, left: 34 }

const { contenedor, svg, ancho, activo, onPointer, onTeclado, salir } = useGraficaInteractiva({
  cantidad: () => props.horas.length,
  posicionX: (i) => x(props.horas[i].hora),
  margen: M,
})

const compacto = computed(() => ancho.value < 520)
const W = computed(() => ancho.value)
const H = computed(() => (compacto.value ? 210 : 250))

const escala = computed(() => rangoTemperatura(props.horas.flatMap((h) => [h.min, h.max])))
const x = (hora) => M.left + (hora / 23) * (W.value - M.left - M.right)
const y = (v) => M.top + (1 - (v - escala.value.min) / (escala.value.max - escala.value.min)) * (H.value - M.top - M.bottom)

const bandas = computed(() => bandasEnRango(escala.value.min, escala.value.max, y))

const linea = computed(() => props.horas.map((h) => `${x(h.hora).toFixed(1)},${y(h.promedio).toFixed(1)}`).join(' '))
// Band: along the max going right, back along the min going left
const area = computed(() => {
  const arriba = props.horas.map((h) => `${x(h.hora).toFixed(1)},${y(h.max).toFixed(1)}`)
  const abajo = [...props.horas].reverse().map((h) => `${x(h.hora).toFixed(1)},${y(h.min).toFixed(1)}`)
  return [...arriba, ...abajo].join(' ')
})

const ticksX = computed(() => (compacto.value ? [0, 6, 12, 18, 23] : [0, 3, 6, 9, 12, 15, 18, 21, 23]))
const etiquetaHora = (h) => `${String(h).padStart(2, '0')}:00`

const seleccion = computed(() => {
  const h = activo.value === null ? null : props.horas[activo.value]
  if (!h) return null
  const px = x(h.hora)
  const py = y(h.promedio)
  return { ...h, px, py, left: Math.min(Math.max(px, 70), W.value - 70), abajo: py < 80 }
})

const masCalida = computed(() => props.horas.reduce((a, b) => (b.promedio > a.promedio ? b : a), props.horas[0]))
const masFresca = computed(() => props.horas.reduce((a, b) => (b.promedio < a.promedio ? b : a), props.horas[0]))

const resumen = computed(() =>
  props.horas.length
    ? `En promedio, la hora más calurosa es ${etiquetaHora(masCalida.value.hora)} (${grados(masCalida.value.promedio)}) y la más fresca ${etiquetaHora(masFresca.value.hora)} (${grados(masFresca.value.promedio)}).`
    : 'Sin datos todavía.'
)
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
        :aria-label="`${resumen} Usa las flechas para recorrer las horas.`"
        :tabindex="horas.length ? 0 : undefined"
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
          <text v-for="h in ticksX" :key="h" :x="x(h)" :y="H - 6" text-anchor="middle">{{ etiquetaHora(h) }}</text>
        </g>

        <polygon v-if="horas.length > 1" :points="area" class="dia__banda" />
        <polyline v-if="horas.length > 1" :points="linea" class="dia__linea" />

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
        <strong>{{ grados(seleccion.promedio) }}</strong>
        <span>{{ grados(seleccion.min) }} a {{ grados(seleccion.max) }}</span>
        <span class="muted">{{ etiquetaHora(seleccion.hora) }}</span>
      </div>
    </div>

    <p class="visually-hidden" aria-live="polite">
      {{ seleccion ? `${etiquetaHora(seleccion.hora)}: promedio ${grados(seleccion.promedio)}, de ${grados(seleccion.min)} a ${grados(seleccion.max)}` : '' }}
    </p>
    <figcaption>{{ resumen }} La franja sombreada va de la mínima a la máxima registrada a esa hora.</figcaption>
  </figure>
</template>

<style scoped>
.dia__banda {
  fill: var(--text);
  opacity: 0.12;
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
</style>
