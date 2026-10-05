<script setup>
defineProps({
  pasos: { type: Array, required: true },
})
</script>

<template>
  <ol class="flujo">
    <li v-for="paso in pasos" :key="paso.titulo" class="flujo__paso card">
      <h3>{{ paso.titulo }}</h3>
      <p>{{ paso.descripcion }}</p>
    </li>
  </ol>
</template>

<style scoped>
.flujo {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

@media (min-width: 720px) {
  .flujo {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
}

.flujo__paso {
  padding: 18px;
  border-top: 4px solid var(--accent);
}

.flujo__paso h3 {
  font-size: 1.4rem;
}

.flujo__paso p {
  margin: 0;
  color: var(--muted);
}
</style>
