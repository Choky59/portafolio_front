<script setup>
/**
 * El pulso's extract on the Resumen tab: links into each view of the Análisis tab (so
 * they're found from the first page) and "¿De qué se habla?" (the same chart as the
 * Panorama view). A topic opens the Noticias view filtered by it.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import EstadoCarga from '../EstadoCarga.vue'
import EstadoError from '../EstadoError.vue'
import Temas from './pulso/Temas.vue'
import { useApi } from '../../composables/useApi'
import { getResumen } from '../../api/pulso'

const props = defineProps({
  slug: { type: String, required: true },
})

const router = useRouter()
const { data, error, loading, reload } = useApi((signal) => getResumen(signal))
const temas = computed(() => data.value?.temas ?? [])
/** "¿De qué se habla?" starts hidden: the explore links come first */
const mostrarTemas = ref(false)

/** The Análisis tab's views (PulsoAnalisis.vue), with what each one answers */
const VISTAS = [
  { clave: 'panorama', nombre: 'Panorama', icono: '📊', texto: 'Los números del periodo: temas, emociones y días.' },
  { clave: 'noticias', nombre: 'Noticias', icono: '📰', texto: 'Busca y filtra cada nota con su análisis completo.' },
  { clave: 'medios', nombre: 'Medios', icono: '📻', texto: 'Qué cubre cada medio y cómo habla del gobierno.' },
  { clave: 'mapa', nombre: 'Mapa', icono: '🗺️', texto: 'Dónde pasó cada noticia y qué emoción dejó.' },
  { clave: 'actores', nombre: 'Actores', icono: '🗣️', texto: 'Quién sale hablando: funcionarios y ciudadanos.' },
]
const enlace = (vista) => ({
  name: 'proyecto-analisis',
  params: { slug: props.slug },
  query: { vista },
})

function verTema(tema) {
  router.push({ name: 'proyecto-analisis', params: { slug: props.slug }, query: { vista: 'noticias', tema } })
}
</script>

<template>
  <div>
    <nav class="explora" aria-labelledby="r-explora">
      <h2 id="r-explora" class="bloque__titulo">Explora el análisis</h2>
      <ul class="explora__lista">
        <li v-for="v in VISTAS" :key="v.clave">
          <RouterLink :to="enlace(v.clave)" class="explora__vista">
            <span class="explora__icono" aria-hidden="true">{{ v.icono }}</span>
            <span class="explora__nombre">{{ v.nombre }} <span aria-hidden="true">→</span></span>
            <span class="explora__texto">{{ v.texto }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>

    <section aria-labelledby="r-temas">
      <div class="temas__cabeza">
        <h2 id="r-temas" class="bloque__titulo">¿De qué se habla?</h2>
        <button
          type="button"
          class="btn btn--sm"
          :class="{ 'btn--ghost': mostrarTemas }"
          :aria-expanded="mostrarTemas"
          aria-controls="r-temas-panel"
          @click="mostrarTemas = !mostrarTemas"
        >
          {{ mostrarTemas ? 'Ocultar los temas' : 'Mostrar los temas' }}
        </button>
      </div>
      <div v-if="mostrarTemas" id="r-temas-panel">
        <EstadoCarga v-if="loading && !data" texto="Cargando los temas…" />
        <EstadoError v-else-if="error" :error="error" titulo="No se pudieron cargar los temas" @reintentar="reload" />
        <p v-else-if="!temas.length" class="muted">Todavía no hay noticias analizadas.</p>
        <template v-else>
          <p class="muted">
            Cada barra es un tema, repartida según la emoción que domina en cada una de sus noticias. Toca uno para ver
            sus notas en el análisis.
          </p>
          <Temas :temas="temas" @tema="verTema" />
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.bloque__titulo {
  font-size: clamp(1.9rem, 6vw, 2.4rem);
}

.explora {
  margin-bottom: 48px;
}

.temas__cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.explora__lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}

.explora__vista {
  height: 100%;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas: 'icono nombre' 'texto texto';
  align-items: center;
  gap: 8px 10px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 0.15s ease,
    transform 0.15s ease,
    background 0.15s ease;
}

.explora__vista:hover,
.explora__vista:focus-visible {
  border-color: var(--accent);
  background: var(--surface-2);
  transform: translateY(-2px);
}

.explora__icono {
  grid-area: icono;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--surface-2);
  font-size: 1.2rem;
}

.explora__nombre {
  grid-area: nombre;
  font-weight: 800;
  font-size: 1.05rem;
}

.explora__nombre span {
  color: var(--accent-ink);
  transition: margin-left 0.15s ease;
}

.explora__vista:hover .explora__nombre span {
  margin-left: 4px;
}

.explora__texto {
  grid-area: texto;
  font-size: 0.88rem;
  line-height: 1.35;
  opacity: 0.8;
}

@media (prefers-reduced-motion: reduce) {
  .explora__vista,
  .explora__nombre span {
    transition: none;
  }

  .explora__vista:hover,
  .explora__vista:focus-visible {
    transform: none;
  }
}
</style>
