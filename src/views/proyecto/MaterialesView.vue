<script setup>
import Materiales from '../../components/secciones/Materiales.vue'
import PasoAPaso from '../../components/secciones/PasoAPaso.vue'
import NotFoundView from '../NotFoundView.vue'
import { useHeadSeccion, useProyecto } from '../../composables/useProyecto'

const { proyecto } = useProyecto()
useHeadSeccion('Materiales')
</script>

<template>
  <NotFoundView v-if="!proyecto.materiales.length && !proyecto.pasos.length" />

  <template v-else>
    <section v-if="proyecto.materiales.length" aria-labelledby="m-titulo">
      <h2 id="m-titulo" class="titulo">Materiales</h2>
      <Materiales :materiales="proyecto.materiales" />
    </section>

    <section v-if="proyecto.pasos.length" class="pasos" aria-labelledby="m-pasos">
      <h2 id="m-pasos" class="titulo">Paso a paso</h2>
      <PasoAPaso :pasos="proyecto.pasos" />
    </section>
  </template>
</template>

<style scoped>
.titulo {
  font-size: clamp(1.9rem, 6vw, 2.4rem);
}

.pasos {
  margin-top: 40px;
}
</style>
