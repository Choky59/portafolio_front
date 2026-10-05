<script setup>
defineProps({
  texto: { type: String, default: 'Cargando…' },
})
</script>

<template>
  <div class="carga" role="status" aria-live="polite">
    <span class="carga__sol" aria-hidden="true" />
    <span>{{ texto }}</span>
  </div>
</template>

<style scoped>
.carga {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 0;
  color: var(--muted);
}

.carga__sol {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  border-right-color: transparent;
  animation: girar 0.9s linear infinite;
}

@keyframes girar {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .carga__sol { animation: none; }
}
</style>
