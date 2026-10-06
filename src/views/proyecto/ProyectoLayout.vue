<script setup>
/**
 * Shell of a project page: loads the project once and shares it with every tab
 * (Resumen, Videos, Cómo funciona...), so switching tabs is instant.
 * Compact 3D header + sticky tab bar + the active tab + prev/next project.
 */
import { computed, provide, watch } from 'vue'
import { useRoute } from 'vue-router'

import ThreeCanvas from '../../components/ThreeCanvas.vue'
import EstadoCarga from '../../components/EstadoCarga.vue'
import EstadoError from '../../components/EstadoError.vue'
import NavProyectos from '../../components/NavProyectos.vue'
import ProyectoTabs from '../../components/proyecto/ProyectoTabs.vue'
import NotFoundView from '../NotFoundView.vue'

import { cargarPortada } from '../../three/portadas'
import { useApi } from '../../composables/useApi'
import { PROYECTO_KEY } from '../../composables/useProyecto'
import { getProyecto } from '../../api/proyectos'

const route = useRoute()
const slug = computed(() => route.params.slug)

const { data, error, loading, reload } = useApi((signal) => getProyecto(slug.value, signal))
watch(slug, () => reload())

const proyecto = computed(() => data.value?.proyecto ?? null)
const anterior = computed(() => data.value?.anterior ?? null)
const siguiente = computed(() => data.value?.siguiente ?? null)
const noEncontrado = computed(() => error.value?.status === 404)

provide(PROYECTO_KEY, { proyecto, anterior, siguiente })

const cargarEncabezado = () => cargarPortada(slug.value)
</script>

<template>
  <NotFoundView v-if="noEncontrado" />

  <div v-else-if="loading && !proyecto" class="container">
    <EstadoCarga texto="Cargando proyecto…" />
  </div>

  <div v-else-if="error" class="container">
    <EstadoError :error="error" @reintentar="reload" />
  </div>

  <article v-else-if="proyecto" :key="proyecto.slug">
    <header class="encabezado">
      <div class="encabezado__escena">
        <ThreeCanvas :cargar="cargarEncabezado" :params="{ numero: proyecto.numero }">
          <template #poster>
            <div class="encabezado__poster" />
          </template>
        </ThreeCanvas>
      </div>

      <div class="encabezado__texto container">
        <RouterLink to="/#proyectos" class="encabezado__volver">← Proyectos</RouterLink>
        <p class="encabezado__numero">
          Proyecto #{{ proyecto.numero }}
          <span v-if="proyecto.enVivo" class="badge-live">En vivo</span>
        </p>
        <h1 class="encabezado__titulo">{{ proyecto.titulo }}</h1>
        <p class="encabezado__resumen">{{ proyecto.resumen }}</p>
      </div>
    </header>

    <ProyectoTabs :proyecto="proyecto" />

    <div id="contenido-seccion" class="contenido container">
      <RouterView />
    </div>

    <section class="container contenido__vecinos">
      <NavProyectos :anterior="anterior" :siguiente="siguiente" />
    </section>
  </article>
</template>

<style scoped>
.encabezado {
  position: relative;
  height: max(34vh, 260px);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

@media (min-width: 720px) {
  .encabezado {
    height: max(46vh, 340px);
  }
}

.encabezado__escena {
  position: absolute;
  inset: 0;
}

.encabezado__escena::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--bg) 6%, color-mix(in srgb, var(--bg) 45%, transparent) 55%, transparent);
  pointer-events: none;
}

.encabezado__poster {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 70% 35%, var(--accent) 0 9%, transparent 10%), var(--surface);
}

.encabezado__texto {
  position: relative;
  padding-top: 72px;
  padding-bottom: 14px;
}

.encabezado__volver {
  display: inline-block;
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 0.9rem;
}

.encabezado__numero {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--accent-ink);
}

.encabezado__titulo {
  font-size: clamp(2.3rem, 8vw, 3.6rem);
  margin: 2px 0 4px;
}

.encabezado__resumen {
  max-width: 40rem;
  margin: 0;
  color: var(--muted);
  /* One short line on phones; the full text lives in the Resumen tab */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.contenido {
  padding-top: 24px;
  padding-bottom: 32px;
  min-height: 50vh;
}

.contenido__vecinos {
  padding-bottom: 48px;
}
</style>
