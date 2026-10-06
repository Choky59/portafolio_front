<script setup>
import ThreeCanvas from './ThreeCanvas.vue'
import { cargarPortada } from '../three/portadas'
import { useMediaQuery } from '../composables/useMediaQuery'

const props = defineProps({
  proyecto: { type: Object, required: true },
})

const cargar = () => cargarPortada(props.proyecto.slug)

// Phones get the illustrated poster: no WebGL context or 3D download per card
const con3D = useMediaQuery('(min-width: 720px)')
</script>

<template>
  <article class="tarjeta card">
    <div class="tarjeta__portada">
      <ThreeCanvas v-if="con3D" :cargar="cargar" :params="{ numero: proyecto.numero }" liberar-fuera-de-pantalla>
        <template #poster>
          <div class="tarjeta__poster" />
        </template>
      </ThreeCanvas>
      <div v-else class="tarjeta__poster" aria-hidden="true" />
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
  aspect-ratio: 16 / 7;
  overflow: hidden;
  background: var(--surface-2);
}

@media (min-width: 720px) {
  .tarjeta__portada {
    aspect-ratio: 16 / 10;
  }
}

/* Illustrated cover (phones, and while the 3D scene loads): sun, mountains and desert floor */
.tarjeta__poster {
  position: relative;
  width: 100%;
  height: 100%;
  background:
    /* Sun on the left so the "En vivo" badge (top right) doesn't cover it */
    radial-gradient(circle at 28% 40%, var(--accent) 0 10%, color-mix(in srgb, var(--accent) 22%, transparent) 11% 16%, transparent 17%),
    linear-gradient(to bottom, var(--surface), var(--surface-2));
}

.tarjeta__poster::before,
.tarjeta__poster::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
}

/* Mountains */
.tarjeta__poster::before {
  bottom: 22%;
  height: 34%;
  background: var(--three-suelo);
  clip-path: polygon(0 100%, 0 55%, 14% 20%, 27% 62%, 42% 8%, 58% 58%, 70% 30%, 84% 66%, 100% 28%, 100% 100%);
}

/* Desert floor */
.tarjeta__poster::after {
  bottom: 0;
  height: 24%;
  background: color-mix(in srgb, var(--three-suelo) 65%, var(--bg));
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
