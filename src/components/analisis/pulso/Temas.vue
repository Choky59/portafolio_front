<script setup>
/**
 * "¿De qué se habla?": one bar per topic, split by the emotion that dominates each of
 * its notes. Shared by Panorama and the project's Resumen tab; a click emits the topic.
 */
import { computed } from 'vue'
import BarraApilada from './BarraApilada.vue'
import { nombreSubtema, nombreTema, segmentosEmocion } from './catalogo'

const props = defineProps({
  temas: { type: Array, required: true },
})
const emit = defineEmits(['tema'])

const maxTema = computed(() => Math.max(1, ...props.temas.map((t) => t.notas)))
const subtemaPrincipal = (t) => Object.entries(t.subtemas ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0]
</script>

<template>
  <ul class="temas">
    <li v-for="t in temas" :key="t.tema">
      <button type="button" class="tema" @click="emit('tema', t.tema)">
        <span class="tema__nombre">
          {{ nombreTema(t.tema) }}
          <small v-if="subtemaPrincipal(t)" class="muted">· sobre todo {{ nombreSubtema(subtemaPrincipal(t)).toLowerCase() }}</small>
        </span>
        <span class="tema__barra" :style="{ width: `${(t.notas / maxTema) * 100}%` }">
          <BarraApilada :segmentos="segmentosEmocion(t.emociones)" :alto="16" />
        </span>
        <strong class="tema__n">{{ t.notas }}</strong>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.temas {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  gap: 4px;
}

.tema {
  display: grid;
  align-items: center;
  gap: 4px 12px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  grid-template-columns: 1fr auto;
  grid-template-areas: 'nombre n' 'barra barra';
}

@media (min-width: 720px) {
  .tema {
    grid-template-columns: minmax(180px, 34%) 1fr 40px;
    grid-template-areas: 'nombre barra n';
  }
}

.tema:hover {
  background: var(--surface);
}

.tema__nombre {
  grid-area: nombre;
  font-weight: 700;
}

.tema__nombre small {
  font-weight: 400;
}

.tema__barra {
  grid-area: barra;
  min-width: 8px;
}

.tema__n {
  grid-area: n;
  text-align: right;
}
</style>
