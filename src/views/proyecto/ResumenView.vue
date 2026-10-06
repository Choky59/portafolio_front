<script setup>
import { computed } from 'vue'
import ProblemaSolucion from '../../components/secciones/ProblemaSolucion.vue'
import Retos from '../../components/secciones/Retos.vue'
import SerieVideos from '../../components/proyecto/SerieVideos.vue'
import { dashboards } from '../../components/dashboards'
import { useHeadSeccion, useProyecto } from '../../composables/useProyecto'

const { proyecto } = useProyecto()
useHeadSeccion(null)

const dashboard = computed(() => (proyecto.value.enVivo ? (dashboards[proyecto.value.slug] ?? null) : null))
const hayProblemaSolucion = computed(
  () => !!(proyecto.value.problema || proyecto.value.solucion || proyecto.value.resultado)
)
</script>

<template>
  <section v-if="dashboard" class="bloque" aria-labelledby="r-vivo">
    <h2 id="r-vivo" class="bloque__titulo">En vivo</h2>
    <component :is="dashboard" />
  </section>

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
</style>
