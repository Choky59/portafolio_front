<script setup>
/**
 * Featured "Mira cómo lo construí" block of the Resumen tab: the project's video
 * series, where most of the teaching content lives.
 */
defineProps({
  slugProyecto: { type: String, required: true },
  videos: { type: Array, required: true },
})

const disponible = (v) => !!(v.src || v.youtubeId)
</script>

<template>
  <section class="serie" aria-labelledby="serie-titulo">
    <h2 id="serie-titulo" class="serie__titulo">Mira cómo lo construí</h2>
    <p class="serie__intro">
      {{ videos.length }} {{ videos.length === 1 ? 'video corto' : 'videos cortos' }}, cada uno con su explicación técnica
      paso a paso.
    </p>

    <ol class="serie__lista">
      <li v-for="v in videos" :key="v.slug">
        <RouterLink
          :to="{ name: 'proyecto-video', params: { slug: slugProyecto, video: v.slug } }"
          class="parte"
        >
          <span class="parte__numero" aria-hidden="true">{{ v.parte }}</span>
          <span class="parte__texto">
            <span class="parte__titulo">{{ v.titulo }}</span>
            <span class="parte__meta">
              Parte {{ v.parte }}<template v-if="v.duracion"> · {{ v.duracion }}</template>
              <template v-if="v.temas.length"> · {{ v.temas.slice(0, 2).join(', ') }}</template>
            </span>
          </span>
          <span v-if="disponible(v)" class="parte__play" aria-hidden="true">▶</span>
          <span v-else class="parte__pronto">Pronto</span>
        </RouterLink>
      </li>
    </ol>

    <RouterLink :to="{ name: 'proyecto-videos', params: { slug: slugProyecto } }" class="serie__todos">
      Ver todos los videos →
    </RouterLink>
  </section>
</template>

<style scoped>
.serie {
  padding: 22px 18px;
  border-radius: var(--radius-lg);
  border: 2px solid var(--accent);
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 55%),
    var(--surface);
}

.serie__titulo {
  font-size: clamp(2.1rem, 8vw, 2.8rem);
  margin-bottom: 4px;
}

.serie__intro {
  color: var(--muted);
}

.serie__lista {
  list-style: none;
  padding: 0;
  margin: 14px 0 10px;
  display: grid;
  gap: 10px;
}

.parte {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  text-decoration: none;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.parte:hover,
.parte:focus-visible {
  border-color: var(--accent);
  transform: translateX(2px);
}

.parte__numero {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--surface-2);
  font-family: var(--font-title);
  font-size: 1.6rem;
}

.parte__texto {
  flex: 1;
  display: grid;
  gap: 2px;
  min-width: 0;
}

.parte__titulo {
  font-weight: 700;
  line-height: 1.3;
}

.parte__meta {
  font-size: 0.85rem;
  color: var(--muted);
}

.parte__play {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  padding-left: 3px;
}

.parte__pronto {
  flex: 0 0 auto;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted);
}

.serie__todos {
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .parte,
  .parte:hover {
    transition: none;
    transform: none;
  }
}
</style>
