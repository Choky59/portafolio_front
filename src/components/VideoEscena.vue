<script setup>
/**
 * Short MP4 scene from the storage/CDN. Plays muted in a loop only while visible;
 * with reduced motion it doesn't autoplay and shows controls instead.
 */
import { ref, watch } from 'vue'
import { useVisible } from '../composables/useVisible'
import { useReducedMotion } from '../composables/useReducedMotion'

const props = defineProps({
  titulo: { type: String, required: true },
  src: { type: String, required: true },
  poster: { type: String, default: undefined },
})

const video = ref(null)
const visible = useVisible(video, { rootMargin: '0px', threshold: 0.25 })
const reducido = useReducedMotion()

watch([visible, reducido], ([esVisible, esReducido]) => {
  const el = video.value
  if (!el) return
  if (esVisible && !esReducido) {
    el.play().catch(() => {
      // autoplay blocked (e.g. low-power mode): the poster stays
    })
  } else {
    el.pause()
  }
})
</script>

<template>
  <figure class="escena">
    <video
      ref="video"
      :poster="props.poster"
      :controls="reducido"
      muted
      loop
      playsinline
      preload="none"
    >
      <source :src="props.src" type="video/mp4" />
    </video>
    <figcaption>{{ titulo }}</figcaption>
  </figure>
</template>

<style scoped>
.escena {
  margin: 0;
}

.escena video {
  width: 100%;
  aspect-ratio: 9 / 16;
  max-height: 80vh;
  object-fit: cover;
  border-radius: var(--radius);
  background: var(--surface-2);
}

figcaption {
  margin-top: 8px;
  font-weight: 600;
}
</style>
