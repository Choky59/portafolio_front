<script setup>
defineProps({
  reiniciar: { type: Boolean, default: false },
})
</script>

<template>
  <p class="teclas muted">
    <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> o <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> manejar ·
    <kbd>Espacio</kbd> freno de mano<template v-if="reiniciar"> · <kbd>R</kbd> volver a la salida</template>
  </p>
</template>

<style scoped>
.teclas {
  margin: 0;
  font-size: 0.9rem;
}

kbd {
  display: inline-block;
  min-width: 1.6em;
  padding: 1px 6px;
  margin: 0 1px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 6px;
  font: 600 0.8rem var(--font-body);
  text-align: center;
}
</style>
