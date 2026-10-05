<script setup>
defineProps({
  retos: { type: Array, required: true },
})
</script>

<template>
  <div class="retos">
    <article v-for="reto in retos" :key="reto.titulo" class="retos__item card">
      <h3>{{ reto.titulo }}</h3>
      <p>{{ reto.descripcion }}</p>
    </article>
  </div>
</template>

<style scoped>
.retos {
  display: grid;
  gap: 12px;
}

.retos__item {
  padding: 18px;
  border-left: 4px solid var(--extremo);
}

.retos__item h3 {
  font-size: 1.4rem;
}

.retos__item p {
  margin: 0;
}
</style>
