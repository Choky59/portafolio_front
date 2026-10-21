<script setup>
/**
 * One horizontal bar split in colored parts (e.g. the emotions of a topic), with an
 * optional legend. Each part's width is its share of the total. The outline keeps the
 * white (neutral) part visible on light backgrounds.
 */
import { computed } from 'vue'

const props = defineProps({
  segmentos: { type: Array, required: true }, // [{ clave, etiqueta, valor, color }]
  leyenda: { type: Boolean, default: false },
  porcentaje: { type: Boolean, default: false }, // legend in % instead of counts
  alto: { type: Number, default: 14 },
})

const total = computed(() => props.segmentos.reduce((s, x) => s + x.valor, 0))
const partes = computed(() =>
  props.segmentos.map((s) => ({ ...s, ancho: total.value ? (s.valor / total.value) * 100 : 0 }))
)
const texto = (s) => (props.porcentaje ? `${Math.round(s.ancho)}%` : s.valor)
const resumen = computed(() => partes.value.map((s) => `${s.etiqueta} ${texto(s)}`).join(', '))
</script>

<template>
  <div class="apilada">
    <div class="apilada__barra" role="img" :aria-label="resumen" :style="{ height: `${alto}px` }">
      <span
        v-for="s in partes"
        :key="s.clave"
        class="apilada__parte"
        :style="{ width: `${s.ancho}%`, background: s.color }"
        :title="`${s.etiqueta}: ${texto(s)}`"
      />
    </div>
    <ul v-if="leyenda" class="apilada__leyenda">
      <li v-for="s in partes" :key="s.clave">
        <span class="apilada__punto" :style="{ background: s.color }" aria-hidden="true" />
        {{ s.etiqueta }} <strong>{{ texto(s) }}</strong>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.apilada__barra {
  display: flex;
  overflow: hidden;
  border-radius: 999px;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
}

.apilada__parte {
  height: 100%;
  min-width: 3px;
}

.apilada__parte + .apilada__parte {
  border-left: 1.5px solid var(--bg);
}

.apilada__leyenda {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 0.85rem;
}

.apilada__punto {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  margin-right: 4px;
  vertical-align: -1px;
}
</style>
