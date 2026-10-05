<script setup>
import ThreeCanvas from './ThreeCanvas.vue'
import { cargarPortada } from '../three/portadas'

const props = defineProps({
  proyecto: { type: Object, required: true },
})

const cargar = () => cargarPortada(props.proyecto.slug)
</script>

<template>
  <article class="tarjeta card">
    <div class="tarjeta__portada">
      <ThreeCanvas :cargar="cargar" :params="{ numero: proyecto.numero }" liberar-fuera-de-pantalla>
        <template #poster>
          <div class="tarjeta__poster">#{{ proyecto.numero }}</div>
        </template>
      </ThreeCanvas>
      <span v-if="proyecto.enVivo" class="badge-live tarjeta__vivo">En vivo</span>
    </div>

    <div class="tarjeta__cuerpo">
      <p class="tarjeta__numero">Proyecto #{{ proyecto.numero }}</p>
      <h3 class="tarjeta__titulo">
        <!-- The whole card is clickable through this link (stretched with ::after) -->
        <RouterLink :to="`/proyectos/${proyecto.slug}`" class="tarjeta__link">
          {{ proyecto.titulo }}
        </RouterLink>
      </h3>
      <p class="tarjeta__resumen">{{ proyecto.resumen }}</p>
      <ul class="chips" aria-label="Tecnologías">
        <li v-for="tec in proyecto.tecnologias" :key="tec" class="chip">{{ tec }}</li>
      </ul>
    </div>
  </article>
</template>

<style scoped>
.tarjeta {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.tarjeta:hover,
.tarjeta:focus-within {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}

.tarjeta__portada {
  position: relative;
  aspect-ratio: 16 / 10;
  background: var(--surface-2);
}

.tarjeta__poster {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font-family: var(--font-title);
  font-size: 4rem;
  color: var(--accent);
}

.tarjeta__vivo {
  position: absolute;
  top: 12px;
  right: 12px;
}

.tarjeta__cuerpo {
  padding: 18px 18px 22px;
}

.tarjeta__numero {
  margin: 0;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--accent-ink);
}

.tarjeta__titulo {
  margin: 4px 0 8px;
}

.tarjeta__link {
  color: var(--text);
  text-decoration: none;
}

.tarjeta__link::after {
  content: '';
  position: absolute;
  inset: 0;
}

.tarjeta__resumen {
  color: var(--muted);
}

@media (prefers-reduced-motion: reduce) {
  .tarjeta,
  .tarjeta:hover {
    transition: none;
    transform: none;
  }
}
</style>
