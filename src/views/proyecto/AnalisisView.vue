<script setup>
import { computed } from 'vue'
import NotFoundView from '../NotFoundView.vue'
import { analisis } from '../../components/analisis'
import { useHeadSeccion, useProyecto } from '../../composables/useProyecto'

const { proyecto } = useProyecto()
useHeadSeccion('Análisis')

const componente = computed(() => analisis[proyecto.value.slug] ?? null)
</script>

<template>
  <NotFoundView v-if="!componente" />
  <component :is="componente" v-else />
</template>
