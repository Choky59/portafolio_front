<script setup>
import HeroSerie from '../components/HeroSerie.vue'
import ProyectoCard from '../components/ProyectoCard.vue'
import EstadoCarga from '../components/EstadoCarga.vue'
import EstadoError from '../components/EstadoError.vue'
import { useApi } from '../composables/useApi'
import { listProyectos } from '../api/proyectos'

const { data: proyectos, error, loading, reload } = useApi(listProyectos)
</script>

<template>
  <HeroSerie />

  <section id="proyectos" class="section container" aria-labelledby="titulo-proyectos">
    <h2 id="titulo-proyectos">Proyectos</h2>
    <p class="muted">Cada uno nace de un problema real. Toca uno para ver cómo lo resolví, paso a paso.</p>

    <EstadoCarga v-if="loading && !proyectos" texto="Cargando proyectos…" />
    <EstadoError v-else-if="error" :error="error" @reintentar="reload" />
    <p v-else-if="proyectos && !proyectos.length" class="muted">Pronto: el primer proyecto está en camino.</p>

    <div v-else-if="proyectos" class="grid">
      <ProyectoCard v-for="p in proyectos" :key="p.slug" :proyecto="p" />
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  gap: 18px;
  margin-top: 24px;
  grid-template-columns: 1fr;
}

@media (min-width: 680px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1040px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
