<script setup>
/** Share of time in each state, as one stacked bar plus its legend */
import { computed } from 'vue'
import { colorEstado } from './escala'

const props = defineProps({
  estados: { type: Array, required: true }, // [{ clave, etiqueta, emoji, porcentaje }]
})

const conTiempo = computed(() => props.estados.filter((e) => e.porcentaje > 0))
const resumen = computed(() => props.estados.map((e) => `${e.etiqueta} ${e.porcentaje}%`).join(', '))
</script>

<template>
  <figure class="estados">
    <div class="estados__barra" role="img" :aria-label="`Tiempo en cada estado: ${resumen}.`">
      <span
        v-for="e in conTiempo"
        :key="e.clave"
        class="estados__tramo"
        :style="{ width: `${e.porcentaje}%`, background: colorEstado(e.clave) }"
        :title="`${e.etiqueta}: ${e.porcentaje}%`"
      />
    </div>

    <ul class="estados__leyenda">
      <li v-for="e in estados" :key="e.clave" :class="{ 'estados__item--cero': !e.porcentaje }">
        <span class="estados__color" :style="{ background: colorEstado(e.clave) }" aria-hidden="true" />
        <span aria-hidden="true">{{ e.emoji }}</span>
        <span class="estados__etiqueta">{{ e.etiqueta }}</span>
        <strong>{{ e.porcentaje }}%</strong>
      </li>
    </ul>
    <figcaption class="graf__nota">Porcentaje del tiempo con lecturas (una cada 30 segundos).</figcaption>
  </figure>
</template>

<style scoped>
.estados {
  margin: 0;
}

.estados__barra {
  display: flex;
  height: 22px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--surface-2);
}

.estados__tramo {
  height: 100%;
  min-width: 3px;
}

/* Fixed columns (2 on phones, 4 on wide screens) so the separators only go between columns */
.estados__leyenda {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  gap: 8px 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.estados__leyenda li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  font-size: 0.95rem;
}

/* Separator | between legend items in the same row */
.estados__leyenda li:nth-child(even) {
  border-left: 1px solid var(--border);
}

.estados__leyenda li:nth-child(odd) {
  padding-left: 0;
}

@media (min-width: 720px) {
  .estados__leyenda {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .estados__leyenda li:nth-child(odd) {
    padding-left: 12px;
  }

  .estados__leyenda li:not(:first-child) {
    border-left: 1px solid var(--border);
  }

  .estados__leyenda li:first-child {
    padding-left: 0;
  }
}

.estados__etiqueta {
  flex: 1;
}

.estados__item--cero {
  opacity: 0.55;
}

.estados__color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex: 0 0 auto;
}
</style>
