<script setup>
// Tarjeta del juego de un proyecto: su descripción y el botón que lleva a jugarlo en su página
defineProps({
  juego: { type: Object, required: true },
})
</script>

<template>
  <div class="jugar">
    <p class="jugar__texto">{{ juego.texto }}</p>
    <a class="btn jugar__boton" :href="juego.url" target="_blank" rel="noopener">Jugar en {{ juego.nombre }}</a>
  </div>
</template>

<style scoped>
.jugar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.jugar__texto {
  flex: 1 1 280px;
  margin: 0;
}

.jugar__boton {
  flex: 0 0 auto;
  text-decoration: none;
}
</style>
