<script setup>
/**
 * A tone from -1 (critical) to 1 (favorable) as a bar growing left or right from the
 * center line. Empty (dashed) when there's no data.
 */
import { computed } from 'vue'
import { tonoEnPalabras } from './catalogo'

const props = defineProps({
  valor: { type: Number, default: null },
  etiqueta: { type: String, default: '' },
})

const ancho = computed(() => (props.valor === null ? 0 : Math.min(1, Math.abs(props.valor)) * 50))
const positivo = computed(() => (props.valor ?? 0) >= 0)
const texto = computed(() => tonoEnPalabras(props.valor))
</script>

<template>
  <div class="tono" role="img" :aria-label="`${etiqueta}: ${texto}${valor === null ? '' : ` (${valor.toFixed(2)})`}`">
    <div class="tono__pista" :class="{ 'tono__pista--vacia': valor === null }">
      <span
        v-if="valor !== null"
        class="tono__barra"
        :class="positivo ? 'tono__barra--favor' : 'tono__barra--contra'"
        :style="{ width: `${ancho}%`, [positivo ? 'left' : 'right']: '50%' }"
      />
      <span class="tono__centro" aria-hidden="true" />
    </div>
    <span class="tono__texto">{{ texto }}</span>
  </div>
</template>

<style scoped>
.tono {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
}

.tono__pista {
  position: relative;
  height: 12px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1.5px solid var(--border);
}

.tono__pista--vacia {
  border-style: dashed;
  background: transparent;
}

.tono__barra {
  position: absolute;
  top: 0;
  bottom: 0;
}

.tono__barra--favor {
  background: var(--ideal);
  border-radius: 0 999px 999px 0;
}

.tono__barra--contra {
  background: var(--extremo);
  border-radius: 999px 0 0 999px;
}

.tono__centro {
  position: absolute;
  left: 50%;
  top: -3px;
  bottom: -3px;
  width: 2px;
  background: var(--muted);
}

.tono__texto {
  font-size: 0.8rem;
  color: var(--muted);
  min-width: 84px;
  text-align: right;
}
</style>
