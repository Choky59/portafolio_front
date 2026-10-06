<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import VideoArchivo from '../../components/VideoArchivo.vue'
import VideoYoutube from '../../components/VideoYoutube.vue'
import Articulo from '../../components/proyecto/Articulo.vue'
import NotFoundView from '../NotFoundView.vue'
import { useHeadSeccion, useProyecto } from '../../composables/useProyecto'

const route = useRoute()
const { proyecto } = useProyecto()

const indice = computed(() => proyecto.value.videos.findIndex((v) => v.slug === route.params.video))
const video = computed(() => proyecto.value.videos[indice.value] ?? null)
const anterior = computed(() => proyecto.value.videos[indice.value - 1] ?? null)
const siguiente = computed(() => proyecto.value.videos[indice.value + 1] ?? null)

useHeadSeccion('Videos', () =>
  video.value ? { nombre: `Parte ${video.value.parte}: ${video.value.titulo}`, descripcion: video.value.resumen } : {}
)

const rutaVideo = (v) => ({ name: 'proyecto-video', params: { slug: proyecto.value.slug, video: v.slug } })
</script>

<template>
  <NotFoundView v-if="!video" />

  <article v-else :key="video.slug" class="video">
    <RouterLink :to="{ name: 'proyecto-videos', params: { slug: proyecto.slug } }" class="video__volver">
      ← Todos los videos
    </RouterLink>

    <div class="video__grid">
      <div class="video__reproductor">
        <VideoArchivo
          v-if="video.src"
          :titulo="video.titulo"
          :src="video.src"
          :poster="video.poster"
          :vertical="video.vertical"
        />
        <VideoYoutube
          v-else-if="video.youtubeId"
          :titulo="video.titulo"
          :youtube-id="video.youtubeId"
          :vertical="video.vertical"
        />
        <!-- Compact notice: no point in a phone-sized empty 9:16 box -->
        <div v-else class="video__pronto card">
          <span class="video__pronto-icono" aria-hidden="true">🎬</span>
          <p><strong>Video próximamente.</strong> <span class="muted">Mientras tanto, aquí está toda la explicación.</span></p>
        </div>
      </div>

      <div class="video__texto">
        <p class="video__parte">
          Parte {{ video.parte }} de {{ proyecto.videos.length }}<span v-if="video.duracion" class="muted"> · {{ video.duracion }}</span>
        </p>
        <h2 class="video__titulo">{{ video.titulo }}</h2>
        <p class="video__resumen">{{ video.resumen }}</p>
        <ul v-if="video.temas.length" class="chips" aria-label="Temas">
          <li v-for="t in video.temas" :key="t" class="chip">{{ t }}</li>
        </ul>

        <Articulo v-if="video.articulo.length" :bloques="video.articulo" class="video__articulo" />
      </div>
    </div>

    <nav v-if="anterior || siguiente" class="partes" aria-label="Otras partes">
      <RouterLink v-if="anterior" :to="rutaVideo(anterior)" class="partes__link card">
        <span class="muted">← Parte {{ anterior.parte }}</span>
        <strong>{{ anterior.titulo }}</strong>
      </RouterLink>
      <span v-else />
      <RouterLink v-if="siguiente" :to="rutaVideo(siguiente)" class="partes__link partes__link--siguiente card">
        <span class="muted">Parte {{ siguiente.parte }} →</span>
        <strong>{{ siguiente.titulo }}</strong>
      </RouterLink>
    </nav>
  </article>
</template>

<style scoped>
.video__volver {
  display: inline-block;
  margin-bottom: 14px;
  font-weight: 600;
}

.video__grid {
  display: grid;
  gap: 24px;
}

@media (min-width: 900px) {
  .video__grid {
    grid-template-columns: minmax(280px, 360px) 1fr;
    align-items: start;
  }

  .video__reproductor {
    position: sticky;
    top: 130px; /* top bar + tabs */
  }
}

.video__reproductor {
  max-width: 420px;
  width: 100%;
  margin: 0 auto;
}

.video__pronto {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}

.video__pronto-icono {
  font-size: 1.6rem;
}

.video__pronto p {
  margin: 0;
}

.video__parte {
  margin: 0;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--accent-ink);
}

.video__titulo {
  font-size: clamp(2rem, 7vw, 2.8rem);
  margin: 4px 0 8px;
}

.video__resumen {
  font-size: 1.1rem;
}

.video__articulo {
  margin-top: 28px;
}

.partes {
  display: grid;
  gap: 12px;
  margin-top: 40px;
}

@media (min-width: 640px) {
  .partes {
    grid-template-columns: 1fr 1fr;
  }
}

.partes__link {
  display: grid;
  gap: 4px;
  padding: 16px;
  color: var(--text);
  text-decoration: none;
}

.partes__link--siguiente {
  text-align: right;
}

.partes__link strong {
  font-family: var(--font-title);
  font-weight: 400;
  font-size: 1.4rem;
}
</style>
