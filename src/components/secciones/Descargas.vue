<script setup>
defineProps({
  descargas: { type: Array, required: true },
})
</script>

<template>
  <ul class="descargas">
    <li v-for="d in descargas" :key="d.url">
      <a :href="d.url" class="descargas__item card" target="_blank" rel="noopener" download>
        <span aria-hidden="true">⬇</span>
        <span>{{ d.titulo }}</span>
        <span v-if="d.tipo" class="chip">{{ d.tipo }}</span>
      </a>
    </li>
  </ul>
</template>

<style scoped>
.descargas {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

@media (min-width: 640px) {
  .descargas {
    grid-template-columns: 1fr 1fr;
  }
}

.descargas__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  color: var(--text);
  text-decoration: none;
  font-weight: 600;
}

.descargas__item .chip {
  margin-left: auto;
}
</style>
