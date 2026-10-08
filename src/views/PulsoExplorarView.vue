<script setup>
import PulsoHermosillo from '../components/dashboards/PulsoHermosillo.vue'
</script>

<template>
  <section class="explorar container" aria-labelledby="explorar-titulo">
    <div class="explorar__encabezado">
      <h1 id="explorar-titulo" class="explorar__titulo">El pulso de Hermosillo</h1>
      <RouterLink to="/proyectos/pulso-hermosillo" class="btn btn--ghost btn--sm">← Volver al proyecto</RouterLink>
    </div>
    <PulsoHermosillo modo="completo" class="explorar__pulso" />
  </section>
</template>

<style scoped>
/* Fills the screen under the fixed top bar (60px) */
.explorar {
  display: flex;
  flex-direction: column;
  height: 100svh;
  padding-top: 72px;
  padding-bottom: 12px;
  max-width: none;
}

.explorar__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.explorar__titulo {
  font-size: clamp(1.8rem, 5vw, 2.4rem);
  margin: 0;
}

.explorar__pulso {
  flex: 1;
  min-height: 0;
}
</style>
