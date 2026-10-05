<script setup>
/**
 * Lightweight YouTube embed: shows the thumbnail and only loads the
 * youtube-nocookie iframe when the visitor presses play.
 */
import { computed, ref } from 'vue'

const props = defineProps({
  titulo: { type: String, required: true },
  youtubeId: { type: String, required: true },
  /** Reels/Shorts are 9:16 */
  vertical: { type: Boolean, default: true },
})

const activo = ref(false)

const miniatura = computed(() => `https://i.ytimg.com/vi/${props.youtubeId}/hqdefault.jpg`)
const embed = computed(
  () => `https://www.youtube-nocookie.com/embed/${props.youtubeId}?autoplay=1&rel=0&modestbranding=1`
)
</script>

<template>
  <figure class="video" :class="{ 'video--vertical': vertical }">
    <div class="video__marco">
      <iframe
        v-if="activo"
        :src="embed"
        :title="titulo"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
      />
      <button v-else type="button" class="video__play" @click="activo = true">
        <img :src="miniatura" alt="" loading="lazy" />
        <span class="video__icono" aria-hidden="true">▶</span>
        <span class="visually-hidden">Reproducir {{ titulo }}</span>
      </button>
    </div>
    <figcaption>{{ titulo }}</figcaption>
  </figure>
</template>

<style scoped>
.video {
  margin: 0;
}

.video__marco {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius);
  overflow: hidden;
  background: #000;
}

.video--vertical .video__marco {
  aspect-ratio: 9 / 16;
  max-height: 80vh;
}

.video__marco iframe,
.video__play {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.video__play {
  padding: 0;
  cursor: pointer;
  background: #000;
}

.video__play img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.85;
}

.video__icono {
  position: absolute;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.6rem;
  padding-left: 4px;
}

figcaption {
  margin-top: 8px;
  font-weight: 600;
}
</style>
