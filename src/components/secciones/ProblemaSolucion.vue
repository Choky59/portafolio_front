<script setup>
defineProps({
  problema: { type: String, default: '' },
  solucion: { type: String, default: '' },
  resultado: { type: String, default: '' },
})
</script>

<template>
  <div class="psr">
    <article v-if="problema" class="psr__bloque card">
      <h3>El problema</h3>
      <p>{{ problema }}</p>
    </article>
    <article v-if="solucion" class="psr__bloque card">
      <h3>La solución</h3>
      <p>{{ solucion }}</p>
    </article>
    <article v-if="resultado" class="psr__bloque card">
      <h3>El resultado</h3>
      <p>{{ resultado }}</p>
    </article>
  </div>
</template>

<style scoped>
.psr {
  display: grid;
  gap: 14px;
}

@media (min-width: 900px) {
  .psr {
    grid-template-columns: repeat(3, 1fr);
  }
}

.psr__bloque {
  padding: 20px;
}

.psr__bloque p {
  margin: 0;
}
</style>
