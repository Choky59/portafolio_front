<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import ThreeCanvas from '../components/ThreeCanvas.vue'
import EstadoCarga from '../components/EstadoCarga.vue'
import EstadoError from '../components/EstadoError.vue'
import VideoYoutube from '../components/VideoYoutube.vue'
import VideoArchivo from '../components/VideoArchivo.vue'
import VideoEscena from '../components/VideoEscena.vue'
import ModeloDispositivo from '../components/ModeloDispositivo.vue'
import NavProyectos from '../components/NavProyectos.vue'
import ProblemaSolucion from '../components/secciones/ProblemaSolucion.vue'
import ComoFunciona from '../components/secciones/ComoFunciona.vue'
import Materiales from '../components/secciones/Materiales.vue'
import PasoAPaso from '../components/secciones/PasoAPaso.vue'
import Codigo from '../components/secciones/Codigo.vue'
import Descargas from '../components/secciones/Descargas.vue'
import Retos from '../components/secciones/Retos.vue'
import NotFoundView from './NotFoundView.vue'

import { dashboards } from '../components/dashboards'
import { cargarPortada } from '../three/portadas'
import { useApi } from '../composables/useApi'
import { setHead } from '../composables/useHead'
import { getProyecto } from '../api/proyectos'

const route = useRoute()
const slug = computed(() => route.params.slug)

const { data, error, loading, reload } = useApi((signal) => getProyecto(slug.value, signal))
watch(slug, () => reload())

const proyecto = computed(() => data.value?.proyecto ?? null)
const noEncontrado = computed(() => error.value?.status === 404)

const dashboard = computed(() =>
  proyecto.value?.enVivo ? (dashboards[proyecto.value.slug] ?? null) : null
)

const hayProblemaSolucion = computed(
  () => !!(proyecto.value?.problema || proyecto.value?.solucion || proyecto.value?.resultado)
)

const cargarEncabezado = () => cargarPortada(slug.value)

watch(proyecto, (p) => {
  if (p) setHead({ title: `#${p.numero} ${p.titulo} · Jorge García`, description: p.resumen })
})
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
        <RouterLink to="/#proyectos" class="encabezado__volver">← Todos los proyectos</RouterLink>
        <p class="encabezado__numero">
          Proyecto #{{ proyecto.numero }}
          <span v-if="proyecto.enVivo" class="badge-live">En vivo</span>
        </p>
        <h1>{{ proyecto.titulo }}</h1>
        <p class="encabezado__resumen">{{ proyecto.resumen }}</p>
        <ul class="chips" aria-label="Tecnologías">
          <li v-for="tec in proyecto.tecnologias" :key="tec" class="chip">{{ tec }}</li>
        </ul>
      </div>
    </header>

    <section v-if="proyecto.videos.length" class="section container" aria-labelledby="s-videos">
      <h2 id="s-videos">Videos</h2>
      <div class="videos">
        <template v-for="video in proyecto.videos" :key="video.youtubeId || video.src">
          <VideoArchivo
            v-if="video.src"
            :titulo="video.titulo"
            :src="video.src"
            :poster="video.poster"
            :vertical="video.vertical !== false"
          />
          <VideoYoutube
            v-else
            :titulo="video.titulo"
            :youtube-id="video.youtubeId"
            :vertical="video.vertical !== false"
          />
        </template>
      </div>
    </section>

    <section v-if="dashboard" class="section container" aria-labelledby="s-vivo">
      <h2 id="s-vivo">En vivo</h2>
      <component :is="dashboard" />
    </section>

    <section v-if="hayProblemaSolucion" class="section container" aria-labelledby="s-psr">
      <h2 id="s-psr">Problema, solución y resultado</h2>
      <ProblemaSolucion
        :problema="proyecto.problema"
        :solucion="proyecto.solucion"
        :resultado="proyecto.resultado"
      />
    </section>

    <section v-if="proyecto.comoFunciona.length" class="section container" aria-labelledby="s-como">
      <h2 id="s-como">¿Cómo funciona?</h2>
      <ComoFunciona :pasos="proyecto.comoFunciona" />
    </section>

    <section v-if="proyecto.escenas.length" class="section container" aria-labelledby="s-escenas">
      <h2 id="s-escenas">Escenas</h2>
      <div class="videos">
        <VideoEscena
          v-for="escena in proyecto.escenas"
          :key="escena.src"
          :titulo="escena.titulo"
          :src="escena.src"
          :poster="escena.poster"
        />
      </div>
    </section>

    <section v-if="proyecto.modelo3d" class="section container" aria-labelledby="s-modelo">
      <h2 id="s-modelo">El dispositivo en 3D</h2>
      <ModeloDispositivo :src="proyecto.modelo3d.src" :poster="proyecto.modelo3d.poster" />
    </section>

    <section v-if="proyecto.materiales.length" class="section container" aria-labelledby="s-materiales">
      <h2 id="s-materiales">Materiales</h2>
      <Materiales :materiales="proyecto.materiales" />
    </section>

    <section v-if="proyecto.pasos.length" class="section container" aria-labelledby="s-pasos">
      <h2 id="s-pasos">Paso a paso</h2>
      <PasoAPaso :pasos="proyecto.pasos" />
    </section>

    <section v-if="proyecto.codigo.length" class="section container" aria-labelledby="s-codigo">
      <h2 id="s-codigo">Código</h2>
      <Codigo :archivos="proyecto.codigo" />
    </section>

    <section v-if="proyecto.descargas.length" class="section container" aria-labelledby="s-descargas">
      <h2 id="s-descargas">Descargas</h2>
      <Descargas :descargas="proyecto.descargas" />
    </section>

    <section v-if="proyecto.retos.length" class="section container" aria-labelledby="s-retos">
      <h2 id="s-retos">Retos</h2>
      <Retos :retos="proyecto.retos" />
    </section>

    <section class="section container">
      <NavProyectos :anterior="data.anterior" :siguiente="data.siguiente" />
    </section>
  </article>
</template>

<style scoped>
.encabezado {
  position: relative;
  min-height: 70vh;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.encabezado__escena {
  position: absolute;
  inset: 0;
}

.encabezado__escena::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--bg) 10%, color-mix(in srgb, var(--bg) 50%, transparent) 60%, transparent);
  pointer-events: none;
}

.encabezado__poster {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 65% 30%, var(--accent) 0 8%, transparent 9%), var(--surface);
}

.encabezado__texto {
  position: relative;
  padding-top: 96px;
  padding-bottom: 32px;
}

.encabezado__volver {
  display: inline-block;
  margin-bottom: 16px;
  font-weight: 600;
}

.encabezado__numero {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-weight: 600;
  color: var(--accent-ink);
}

.encabezado__resumen {
  max-width: 40rem;
  font-size: 1.15rem;
}

.videos {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
}
</style>
