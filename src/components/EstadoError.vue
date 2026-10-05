<script setup>
import { computed } from 'vue'
import { mensajeError } from '../api/client'

const props = defineProps({
  error: { type: [Object, Error], default: null },
  titulo: { type: String, default: 'No se pudo cargar' },
})

defineEmits(['reintentar'])

const mensaje = computed(() => mensajeError(props.error))
</script>

<template>
  <div class="error card" role="alert">
    <p class="error__titulo">{{ titulo }}</p>
    <p class="muted">{{ mensaje }}</p>
    <button type="button" class="btn btn--ghost btn--sm" @click="$emit('reintentar')">Reintentar</button>
  </div>
</template>

<style scoped>
.error {
  padding: 24px;
  text-align: center;
  margin: 24px 0;
}

.error__titulo {
  font-family: var(--font-title);
  font-size: 1.6rem;
  margin-bottom: 4px;
}
</style>
