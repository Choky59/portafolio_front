<script setup>
/**
 * "¿De qué se habla?" on El pulso's Resumen tab (the same chart as the Panorama view).
 * A topic opens the Análisis tab's Noticias view filtered by it.
 */
import { computed } from 'vue'
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

function verTema(tema) {
  router.push({ name: 'proyecto-analisis', params: { slug: props.slug }, query: { vista: 'noticias', tema } })
}
</script>

<template>
  <section aria-labelledby="r-temas">
    <h2 id="r-temas" class="bloque__titulo">¿De qué se habla?</h2>
    <EstadoCarga v-if="loading && !data" texto="Cargando los temas…" />
    <EstadoError v-else-if="error" :error="error" titulo="No se pudieron cargar los temas" @reintentar="reload" />
    <p v-else-if="!temas.length" class="muted">Todavía no hay noticias analizadas.</p>
    <template v-else>
      <p class="muted">
        Cada barra es un tema, repartida según la emoción que domina en cada una de sus noticias. Toca uno para ver sus
        notas en el análisis.
      </p>
      <Temas :temas="temas" @tema="verTema" />
    </template>
  </section>
</template>

<style scoped>
.bloque__titulo {
  font-size: clamp(1.9rem, 6vw, 2.4rem);
}
</style>
