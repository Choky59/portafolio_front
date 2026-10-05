<script setup>
defineProps({
  pasos: { type: Array, required: true },
})
</script>

<template>
  <ol class="pasos">
    <li v-for="(paso, i) in pasos" :key="paso.titulo" class="pasos__item">
      <span class="pasos__numero" aria-hidden="true">{{ i + 1 }}</span>
      <div>
        <h3>{{ paso.titulo }}</h3>
        <p>{{ paso.descripcion }}</p>
        <img v-if="paso.imagen" :src="paso.imagen" :alt="paso.titulo" loading="lazy" class="pasos__imagen" />
      </div>
    </li>
  </ol>
</template>

<style scoped>
.pasos {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 24px;
}

.pasos__item {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 14px;
}

.pasos__numero {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  font-family: var(--font-title);
  font-size: 1.4rem;
}

.pasos__item h3 {
  font-size: 1.4rem;
  margin-top: 6px;
}

.pasos__imagen {
  border-radius: var(--radius);
  margin-top: 8px;
}
</style>
