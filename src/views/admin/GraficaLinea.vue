<script setup>
/**
 * A small line chart in SVG (no library): one or two series over time, with its latest value.
 * `puntos`: [{ t, ...valores }]; `series`: [{ clave, nombre, color }]; `limite`: a dashed line
 * (e.g. the tick budget) that marks where the values become a problem.
 */
import { computed } from 'vue'

const props = defineProps({
  titulo: { type: String, required: true },
  puntos: { type: Array, default: () => [] },
  series: { type: Array, required: true },
  unidad: { type: String, default: '' },
  limite: { type: Number, default: null },
})

const ANCHO = 300
const ALTO = 90

const maximo = computed(() => {
  let m = props.limite ?? 0
  for (const p of props.puntos) for (const s of props.series) m = Math.max(m, p[s.clave] ?? 0)
  return m > 0 ? m * 1.1 : 1
})

const rango = computed(() => {
  const t = props.puntos.map((p) => p.t)
  return t.length ? { desde: Math.min(...t), hasta: Math.max(...t) } : null
})

const x = (t) => (rango.value && rango.value.hasta > rango.value.desde
  ? ((t - rango.value.desde) / (rango.value.hasta - rango.value.desde)) * ANCHO
  : ANCHO)
const y = (v) => ALTO - (v / maximo.value) * ALTO

const lineas = computed(() =>
  props.series.map((s) => {
    let d = ''
    let corte = true
    for (const p of props.puntos) {
      const v = p[s.clave]
      if (v === null || v === undefined) { corte = true; continue }
      d += `${corte ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(v).toFixed(1)}`
      corte = false
    }
    const ultimo = [...props.puntos].reverse().find((p) => p[s.clave] !== null && p[s.clave] !== undefined)
    return { ...s, d, ultimo: ultimo ? ultimo[s.clave] : null }
  }),
)

const formato = (v) => (v === null ? '—' : `${Math.round(v * 10) / 10}${props.unidad}`)
</script>

<template>
  <figure class="grafica card">
    <figcaption class="grafica__cabecera">
      <span class="grafica__titulo">{{ titulo }}</span>
      <span class="grafica__valores">
        <span v-for="l in lineas" :key="l.clave" :style="{ color: l.color }">
          {{ l.nombre }} <b>{{ formato(l.ultimo) }}</b>
        </span>
      </span>
    </figcaption>
    <svg v-if="puntos.length > 1" :viewBox="`0 0 ${ANCHO} ${ALTO}`" preserveAspectRatio="none" class="grafica__svg" role="img" :aria-label="titulo">
      <line v-if="limite !== null" x1="0" :x2="ANCHO" :y1="y(limite)" :y2="y(limite)" class="grafica__limite" />
      <path v-for="l in lineas" :key="l.clave" :d="l.d" :stroke="l.color" fill="none" stroke-width="1.6" vector-effect="non-scaling-stroke" />
    </svg>
    <p v-else class="grafica__vacia muted">Juntando datos…</p>
    <p class="grafica__escala muted">máx. {{ formato(maximo / 1.1) }} · última hora</p>
  </figure>
</template>

<style scoped>
.grafica {
  margin: 0;
  padding: 12px 14px;
}

.grafica__cabecera {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
  font-size: 0.85rem;
}

.grafica__titulo {
  font-weight: 600;
}

.grafica__valores {
  display: flex;
  gap: 10px;
}

.grafica__svg {
  display: block;
  width: 100%;
  height: 90px;
  margin-top: 8px;
}

.grafica__limite {
  stroke: var(--extremo);
  stroke-dasharray: 4 4;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  opacity: 0.6;
}

.grafica__vacia {
  height: 90px;
  display: grid;
  place-items: center;
  margin: 8px 0 0;
  font-size: 0.85rem;
}

.grafica__escala {
  margin: 4px 0 0;
  font-size: 0.75rem;
}
</style>
