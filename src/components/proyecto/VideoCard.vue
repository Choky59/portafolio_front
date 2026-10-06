<script setup>
import { computed } from 'vue'

const props = defineProps({
  slugProyecto: { type: String, required: true },
  video: { type: Object, required: true },
})

const disponible = computed(() => !!(props.video.src || props.video.youtubeId))
const miniatura = computed(
  () => props.video.poster || (props.video.youtubeId ? `https://i.ytimg.com/vi/${props.video.youtubeId}/hqdefault.jpg` : null)
)
</script>

<template>
  <article class="video-card card">
    <div class="video-card__portada">
      <img v-if="miniatura" :src="miniatura" alt="" loading="lazy" />
      <span v-else class="video-card__parte-grande" aria-hidden="true">{{ video.parte }}</span>
      <span v-if="!disponible" class="video-card__pronto">Próximamente</span>
      <span v-else class="video-card__play" aria-hidden="true">▶</span>
    </div>

    <div class="video-card__cuerpo">
      <p class="video-card__parte">
        Parte {{ video.parte }}<span v-if="video.duracion" class="muted"> · {{ video.duracion }}</span>
      </p>
      <h3 class="video-card__titulo">
        <!-- Whole card clickable through this link (stretched with ::after) -->
        <RouterLink
          :to="{ name: 'proyecto-video', params: { slug: slugProyecto, video: video.slug } }"
          class="video-card__link"
        >
          {{ video.titulo }}
        </RouterLink>
      </h3>
      <p class="muted video-card__resumen">{{ video.resumen }}</p>
      <ul v-if="video.temas.length" class="chips" aria-label="Temas">
        <li v-for="t in video.temas" :key="t" class="chip">{{ t }}</li>
      </ul>
    </div>
  </article>
</template>

<style scoped>
.video-card {
  position: relative;
  display: grid;
  grid-template-columns: 104px 1fr;
  gap: 14px;
  padding: 12px;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.video-card:hover,
.video-card:focus-within {
  transform: translateY(-2px);
  border-color: var(--accent);
}

.video-card__portada {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 9 / 16;
  border-radius: 10px;
  overflow: hidden;
  background: radial-gradient(circle at 70% 25%, var(--accent) 0 14%, transparent 15%), var(--surface-2);
}

.video-card__portada img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-card__parte-grande {
  font-family: var(--font-title);
  font-size: 3rem;
  color: var(--text);
}

.video-card__play {
  position: absolute;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  padding-left: 3px;
}

.video-card__pronto {
  position: absolute;
  bottom: 8px;
  left: 6px;
  right: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
}

.video-card__parte {
  margin: 0;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--accent-ink);
}

.video-card__titulo {
  font-size: 1.5rem;
  margin: 2px 0 6px;
}

.video-card__link {
  color: var(--text);
  text-decoration: none;
}

.video-card__link::after {
  content: '';
  position: absolute;
  inset: 0;
}

.video-card__resumen {
  font-size: 0.95rem;
  margin-bottom: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .video-card,
  .video-card:hover {
    transition: none;
    transform: none;
  }
}
</style>
