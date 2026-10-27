<script setup>
import { computed, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import NotFoundView from '../NotFoundView.vue'
import { analisis, analisisEnResumen } from '../../components/analisis'
import { useHeadSeccion, useProyecto } from '../../composables/useProyecto'

const { proyecto } = useProyecto()
useHeadSeccion('Análisis')

const router = useRouter()

// Old links to a project whose analysis moved to the Resumen tab
watchEffect(() => {
  if (analisisEnResumen(proyecto.value.slug)) router.replace({ name: 'proyecto', params: { slug: proyecto.value.slug } })
})

const componente = computed(() => (analisisEnResumen(proyecto.value.slug) ? null : (analisis[proyecto.value.slug] ?? null)))
</script>

<template>
  <NotFoundView v-if="!componente && !analisisEnResumen(proyecto.slug)" />
  <component :is="componente" v-else />
</template>
