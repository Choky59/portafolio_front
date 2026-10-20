<script setup>
/**
 * Daily trend: for each day a vertical bar from the min to the max, with a dot on the
 * average, colored by the state of that average.
 */
import { computed } from 'vue'
import { useGraficaInteractiva } from '../../composables/useGraficaInteractiva'
import { colorEstado, fechaCorta, grados, rangoTemperatura } from './escala'

const props = defineProps({
  dias: { type: Array, required: true }, // [{ fecha, min, max, promedio, estado }]
})

const M = { top: 12, right: 14, bottom: 26, left: 34 }

const { contenedor, svg, ancho, activo, onPointer, onTeclado, salir } = useGraficaInteractiva({
  cantidad: () => props.dias.length,
  posicionX: (i) => x(i),
  margen: M,
})

const W = computed(() => ancho.value)
const H = computed(() => (ancho.value < 520 ? 210 : 250))

const escala = computed(() => rangoTemperatura(props.dias.flatMap((d) => [d.min, d.max])))
const columna = computed(() => (W.value - M.left - M.right) / Math.max(props.dias.length, 1))
const x = (i) => M.left + columna.value * (i + 0.5)
const y = (v) => M.top + (1 - (v - escala.value.min) / (escala.value.max - escala.value.min)) * (H.value - M.top - M.bottom)

const grosor = computed(() => Math.max(3, Math.min(14, columna.value * 0.45)))

// Label every Nth day so they don't overlap (~42 px per label)
const cadaCuantos = computed(() => Math.max(1, Math.ceil(42 / columna.value)))
const etiquetas = computed(() =>
  props.dias.map((d, i) => ({ i, texto: fechaCorta(d.fecha) })).filter(({ i }) => i % cadaCuantos.value === 0)
)

const seleccion = computed(() => {
  const d = activo.value === null ? null : props.dias[activo.value]
  if (!d) return null
  const px = x(activo.value)
  const py = y(d.max)
  return { ...d, px, py, left: Math.min(Math.max(px, 70), W.value - 70), abajo: py < 80 }
})

const resumen = computed(() => {
  if (!props.dias.length) return 'Sin datos todavía.'
  const primero = props.dias[0]
  const ultimo = props.dias[props.dias.length - 1]
  const cambio = ultimo.promedio - primero.promedio
  const tendencia = Math.abs(cambio) < 1 ? 'se mantuvo estable' : cambio > 0 ? `subió ${cambio.toFixed(1)} °C` : `bajó ${Math.abs(cambio).toFixed(1)} °C`
  return `Del ${fechaCorta(primero.fecha)} al ${fechaCorta(ultimo.fecha)} el promedio diario ${tendencia}.`
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
        :aria-label="`${resumen} Usa las flechas para recorrer los días.`"
        :tabindex="dias.length ? 0 : undefined"
        @pointermove="onPointer"
        @pointerdown="onPointer"
        @pointerleave="salir"
        @keydown="onTeclado"
        @blur="salir"
      >
        <g class="graf__eje">
          <g v-for="v in escala.ticks" :key="v">
            <line :x1="M.left" :x2="W - M.right" :y1="y(v)" :y2="y(v)" />
            <text :x="M.left - 6" :y="y(v) + 4" text-anchor="end">{{ v }}°</text>
          </g>
          <text v-for="e in etiquetas" :key="e.i" :x="x(e.i)" :y="H - 6" text-anchor="middle">{{ e.texto }}</text>
        </g>

        <g v-for="(d, i) in dias" :key="d.fecha" :opacity="seleccion && activo !== i ? 0.45 : 1">
          <line
            :x1="x(i)"
            :x2="x(i)"
            :y1="y(d.min)"
            :y2="y(d.max)"
            :stroke="colorEstado(d.estado)"
            :stroke-width="grosor"
            stroke-linecap="round"
          />
          <circle :cx="x(i)" :cy="y(d.promedio)" :r="Math.max(2.5, grosor / 2.4)" class="tend__promedio" />
        </g>
      </svg>

      <div
        v-if="seleccion"
        class="graf__tooltip"
        :class="{ 'graf__tooltip--abajo': seleccion.abajo }"
        :style="{ left: `${seleccion.left}px`, top: `${seleccion.py}px` }"
        aria-hidden="true"
      >
        <strong>{{ fechaCorta(seleccion.fecha) }}</strong>
        <span>Máx {{ grados(seleccion.max) }} · Mín {{ grados(seleccion.min) }}</span>
        <span class="muted">Promedio {{ grados(seleccion.promedio) }}</span>
      </div>
    </div>

    <p class="visually-hidden" aria-live="polite">
      {{ seleccion ? `${fechaCorta(seleccion.fecha)}: máxima ${grados(seleccion.max)}, mínima ${grados(seleccion.min)}, promedio ${grados(seleccion.promedio)}` : '' }}
    </p>
    <figcaption>{{ resumen }} Cada barra va de la mínima a la máxima del día; el punto es el promedio.</figcaption>
  </figure>
</template>

<style scoped>
.tend__promedio {
  fill: var(--text);
  stroke: var(--bg);
  stroke-width: 1.5;
}
</style>
