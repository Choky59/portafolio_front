<script setup>
import VideoCard from '../../components/proyecto/VideoCard.vue'
import VideoEscena from '../../components/VideoEscena.vue'
import NotFoundView from '../NotFoundView.vue'
import { useHeadSeccion, useProyecto } from '../../composables/useProyecto'

const { proyecto } = useProyecto()
useHeadSeccion('Videos')
</script>

<template>
  <NotFoundView v-if="!proyecto.videos.length && !proyecto.escenas.length" />

  <template v-else>
    <section v-if="proyecto.videos.length" aria-labelledby="v-titulo">
      <h2 id="v-titulo" class="titulo">Videos</h2>
      <p class="muted">Cada parte cuenta una etapa del proyecto. Toca una para verla con su explicación técnica.</p>
      <ol class="lista">
        <li v-for="video in proyecto.videos" :key="video.slug">
          <VideoCard :slug-proyecto="proyecto.slug" :video="video" />
        </li>
      </ol>
    </section>

    <section v-if="proyecto.escenas.length" class="escenas" aria-labelledby="v-escenas">
      <h2 id="v-escenas" class="titulo">Escenas</h2>
      <div class="escenas__grid">
        <VideoEscena
          v-for="escena in proyecto.escenas"
          :key="escena.src"
          :titulo="escena.titulo"
          :src="escena.src"
          :poster="escena.poster"
        />
      </div>
    </section>
  </template>
</template>

<style scoped>
.titulo {
  font-size: clamp(1.9rem, 6vw, 2.4rem);
}

.lista {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: grid;
  gap: 12px;
}

@media (min-width: 900px) {
  .lista {
    grid-template-columns: repeat(2, 1fr);
  }
}

.escenas {
  margin-top: 40px;
}

.escenas__grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
}
</style>
