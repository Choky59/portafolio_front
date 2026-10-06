<script setup>
/**
 * Full video uploaded to Firebase Storage: regular player with sound and controls.
 * Only downloads metadata until the visitor presses play.
 */
defineProps({
  titulo: { type: String, required: true },
  src: { type: String, required: true },
  poster: { type: String, default: undefined },
  /** Reels/Shorts are 9:16 */
  vertical: { type: Boolean, default: true },
})
</script>

<template>
  <figure class="video" :class="{ 'video--vertical': vertical }">
    <video :src="src" :poster="poster" :aria-label="titulo" controls playsinline preload="metadata" />
    <figcaption>{{ titulo }}</figcaption>
  </figure>
</template>

<style scoped>
.video {
  margin: 0;
}

video {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius);
  background: #000;
}

.video--vertical video {
  aspect-ratio: 9 / 16;
  max-height: 80vh;
}

figcaption {
  margin-top: 8px;
  font-weight: 600;
}
</style>
