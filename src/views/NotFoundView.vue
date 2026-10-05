<script setup>
import { onMounted } from 'vue'
import { setHead } from '../composables/useHead'

onMounted(() => {
  setHead({ title: 'No encontrado · Jorge García', noindex: true })
})
</script>

<template>
  <section class="no-encontrado container">
    <p class="no-encontrado__codigo" aria-hidden="true">404</p>
    <h1>Hoy no se puede salir… a esta página</h1>
    <p class="muted">La página que buscas no existe o cambió de lugar.</p>
    <RouterLink to="/" class="btn">Ver todos los proyectos</RouterLink>
  </section>
</template>

<style scoped>
.no-encontrado {
  padding-top: 120px;
  padding-bottom: 80px;
  text-align: center;
}

.no-encontrado__codigo {
  font-family: var(--font-title);
  font-size: clamp(5rem, 25vw, 9rem);
  line-height: 1;
  margin: 0;
  color: var(--extremo);
}
</style>
