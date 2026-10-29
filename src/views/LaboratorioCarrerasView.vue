<script setup>
import PruebaManejo from '../components/juegos/PruebaManejo.vue'
</script>

<template>
  <section class="laboratorio container section">
    <h1>Laboratorio: manejo</h1>
    <p class="muted">
      Solo en desarrollo. Un carro en el circuito de prueba, con la misma física que correrá el servidor a 30 ticks por segundo.
    </p>
    <PruebaManejo enfocar-al-inicio />
  </section>
</template>

<style scoped>
.laboratorio {
  padding-top: 96px;
}

.laboratorio h1 {
  font-size: clamp(1.9rem, 6vw, 2.4rem);
  margin-bottom: 4px;
}
</style>
