<script setup>
// El control remoto del modo local ya no vive aquí: la ruta se queda y manda al juego
import JugarJuego from '../components/juegos/JugarJuego.vue'
import { juegos } from '../components/juegos'
</script>

<template>
  <section class="control-vista container section">
    <h1>Edge Racers</h1>
    <JugarJuego :juego="juegos['carreras-hermosillo']" />
  </section>
</template>

<style scoped>
.control-vista {
  padding-top: 96px;
}

.control-vista h1 {
  font-size: clamp(1.9rem, 6vw, 2.4rem);
  margin-bottom: 16px;
}
</style>
