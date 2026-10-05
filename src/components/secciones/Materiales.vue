<script setup>
defineProps({
  materiales: { type: Array, required: true },
})
</script>

<template>
  <ul class="materiales">
    <li v-for="m in materiales" :key="m.nombre" class="materiales__item">
      <span class="materiales__cantidad">{{ m.cantidad ?? 1 }}×</span>
      <span>
        <a v-if="m.url" :href="m.url" target="_blank" rel="noopener">{{ m.nombre }}</a>
        <template v-else>{{ m.nombre }}</template>
        <span v-if="m.nota" class="muted"> · {{ m.nota }}</span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.materiales {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.materiales__item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.materiales__cantidad {
  font-weight: 800;
  color: var(--accent-ink);
  min-width: 2.2em;
}
</style>
