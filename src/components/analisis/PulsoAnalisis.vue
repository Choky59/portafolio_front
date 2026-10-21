<script setup>
/**
 * "Análisis" tab of El pulso de Hermosillo, split in five views so it's easier to take
 * in: Panorama (overview), Noticias (search with filters), Medios (outlets), Mapa
 * (where things happen) and Actores (people and institutions). The view and the filters live in the URL
 * (?vista=noticias&tema=...), so any view can be linked and the back button works.
 */
import { computed, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const VISTAS = [
  { clave: 'panorama', nombre: 'Panorama', componente: defineAsyncComponent(() => import('./pulso/Panorama.vue')) },
  { clave: 'noticias', nombre: 'Noticias', componente: defineAsyncComponent(() => import('./pulso/Noticias.vue')) },
  { clave: 'medios', nombre: 'Medios', componente: defineAsyncComponent(() => import('./pulso/Medios.vue')) },
  { clave: 'mapa', nombre: 'Mapa', componente: defineAsyncComponent(() => import('./pulso/Mapa.vue')) },
  { clave: 'actores', nombre: 'Actores', componente: defineAsyncComponent(() => import('./pulso/Actores.vue')) },
]

const route = useRoute()
const router = useRouter()
const actual = computed(() => VISTAS.find((v) => v.clave === route.query.vista) ?? VISTAS[0])

/** Goes to a view (optionally with Noticias filters): used by the views' links */
function ir(vista, filtros = {}) {
  router.push({ query: { vista, ...filtros } })
}
</script>

<template>
  <div class="pulso-analisis">
    <nav class="subnav" aria-label="Vistas del análisis">
      <RouterLink
        v-for="v in VISTAS"
        :key="v.clave"
        :to="{ query: { vista: v.clave } }"
        class="subnav__vista"
        :aria-current="actual.clave === v.clave ? 'page' : undefined"
      >
        {{ v.nombre }}
      </RouterLink>
    </nav>

    <component :is="actual.componente" @ir="ir" />

    <p class="aviso muted">
      Análisis automático con IA de noticieros y periódicos de Hermosillo. Puede equivocarse: cada nota enlaza a su fuente
      para comprobarla. No se publican nombres de menores de edad.
    </p>
  </div>
</template>

<style scoped>
.subnav {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  padding: 4px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  width: fit-content;
  max-width: 100%;
}

.subnav__vista {
  padding: 8px 16px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--muted);
  text-decoration: none;
}

.subnav__vista:hover {
  color: var(--text);
}

.subnav__vista[aria-current='page'] {
  background: var(--accent);
  color: var(--on-accent);
}

/* Phones: the five views in one row of equal columns */
@media (max-width: 520px) {
  .subnav {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    width: 100%;
    gap: 2px;
  }

  .subnav__vista {
    padding: 8px 4px;
    text-align: center;
    font-size: 0.85rem;
  }
}

.aviso {
  margin-top: 40px;
  font-size: 0.85rem;
}
</style>
