<script setup>
import Codigo from '../../components/secciones/Codigo.vue'
import Descargas from '../../components/secciones/Descargas.vue'
import NotFoundView from '../NotFoundView.vue'
import { useHeadSeccion, useProyecto } from '../../composables/useProyecto'

const { proyecto } = useProyecto()
useHeadSeccion('Código')
</script>

<template>
  <NotFoundView v-if="!proyecto.codigo.length && !proyecto.descargas.length" />

  <template v-else>
    <section v-if="proyecto.codigo.length" aria-labelledby="k-titulo">
      <h2 id="k-titulo" class="titulo">Código</h2>
      <Codigo :archivos="proyecto.codigo" />
    </section>

    <section v-if="proyecto.descargas.length" class="descargas" aria-labelledby="k-descargas">
      <h2 id="k-descargas" class="titulo">Descargas</h2>
      <Descargas :descargas="proyecto.descargas" />
    </section>
  </template>
</template>

<style scoped>
.titulo {
  font-size: clamp(1.9rem, 6vw, 2.4rem);
}

.descargas {
  margin-top: 40px;
}
</style>
