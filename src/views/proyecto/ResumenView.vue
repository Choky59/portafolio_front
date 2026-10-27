<script setup>
import { computed, ref } from 'vue'
import ProblemaSolucion from '../../components/secciones/ProblemaSolucion.vue'
import Retos from '../../components/secciones/Retos.vue'
import SerieVideos from '../../components/proyecto/SerieVideos.vue'
import { dashboards } from '../../components/dashboards'
import { analisis, analisisEnResumen, extractoResumen } from '../../components/analisis'
import { useHeadSeccion, useProyecto } from '../../composables/useProyecto'

const { proyecto } = useProyecto()
useHeadSeccion(null)

const dashboard = computed(() => (proyecto.value.enVivo ? (dashboards[proyecto.value.slug] ?? null) : null))
const analisisArriba = computed(() => (analisisEnResumen(proyecto.value.slug) ? analisis[proyecto.value.slug] : null))
// With the analysis on top, the live chart stays hidden (and not polling) until asked for
const mostrarVivo = ref(false)
const extracto = computed(() => extractoResumen[proyecto.value.slug] ?? null)
const vivoVisible = computed(() => !analisisArriba.value || mostrarVivo.value)
const hayProblemaSolucion = computed(
  () => !!(proyecto.value.problema || proyecto.value.solucion || proyecto.value.resultado)
)
</script>

<template>
  <component :is="analisisArriba" v-if="analisisArriba" class="bloque" />

  <section v-if="dashboard" class="bloque" aria-labelledby="r-vivo">
    <div class="vivo__cabeza">
      <h2 id="r-vivo" class="bloque__titulo">En vivo</h2>
      <button
        v-if="analisisArriba"
        type="button"
        class="btn btn--sm"
        :class="{ 'btn--ghost': mostrarVivo }"
        :aria-expanded="mostrarVivo"
        aria-controls="r-vivo-panel"
        @click="mostrarVivo = !mostrarVivo"
      >
        {{ mostrarVivo ? 'Ocultar la gráfica en vivo' : 'Mostrar la gráfica en vivo' }}
      </button>
    </div>
    <div v-if="vivoVisible" id="r-vivo-panel">
      <component :is="dashboard" />
    </div>
  </section>

  <component :is="extracto" v-if="extracto" class="bloque" :slug="proyecto.slug" />

  <!-- The video series is the main (teaching) content: right after the live data -->
  <SerieVideos v-if="proyecto.videos.length" class="bloque" :slug-proyecto="proyecto.slug" :videos="proyecto.videos" />

  <section v-if="hayProblemaSolucion" class="bloque" aria-labelledby="r-psr">
    <h2 id="r-psr" class="bloque__titulo">Problema, solución y resultado</h2>
    <ProblemaSolucion :problema="proyecto.problema" :solucion="proyecto.solucion" :resultado="proyecto.resultado" />
  </section>

  <section v-if="proyecto.retos.length" class="bloque" aria-labelledby="r-retos">
    <h2 id="r-retos" class="bloque__titulo">Retos</h2>
    <Retos :retos="proyecto.retos" />
  </section>
</template>

<style scoped>
.bloque + .bloque {
  margin-top: 36px;
}

.bloque__titulo {
  font-size: clamp(1.9rem, 6vw, 2.4rem);
}

.vivo__cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}
</style>
