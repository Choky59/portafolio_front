<script setup>
import ComoFunciona from '../../components/secciones/ComoFunciona.vue'
import ModeloDispositivo from '../../components/ModeloDispositivo.vue'
import NotFoundView from '../NotFoundView.vue'
import { useHeadSeccion, useProyecto } from '../../composables/useProyecto'

const { proyecto } = useProyecto()
useHeadSeccion('Cómo funciona')
</script>

<template>
  <NotFoundView v-if="!proyecto.comoFunciona.length && !proyecto.modelo3d" />

  <template v-else>
    <section v-if="proyecto.comoFunciona.length" aria-labelledby="c-titulo">
      <h2 id="c-titulo" class="titulo">¿Cómo funciona?</h2>
      <ComoFunciona :pasos="proyecto.comoFunciona" />
    </section>

    <section v-if="proyecto.modelo3d" class="modelo" aria-labelledby="c-modelo">
      <h2 id="c-modelo" class="titulo">El dispositivo en 3D</h2>
      <ModeloDispositivo :src="proyecto.modelo3d.src" :poster="proyecto.modelo3d.poster" />
    </section>
  </template>
</template>

<style scoped>
.titulo {
  font-size: clamp(1.9rem, 6vw, 2.4rem);
}

.modelo {
  margin-top: 40px;
}
</style>
