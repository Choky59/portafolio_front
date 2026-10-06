<script setup>
/**
 * Technical article of a video: [{ titulo, texto, puntos? }].
 * Paragraphs are separated by a blank line. Rendered as plain text (no v-html).
 */
defineProps({
  bloques: { type: Array, required: true },
})

const parrafos = (texto) => texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
</script>

<template>
  <div class="articulo">
    <section v-for="b in bloques" :key="b.titulo" class="articulo__bloque">
      <h3>{{ b.titulo }}</h3>
      <p v-for="(p, i) in parrafos(b.texto)" :key="i">{{ p }}</p>
      <ul v-if="b.puntos?.length">
        <li v-for="punto in b.puntos" :key="punto">{{ punto }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.articulo {
  max-width: 42rem;
}

.articulo__bloque + .articulo__bloque {
  margin-top: 28px;
}

.articulo h3 {
  font-size: 1.6rem;
  margin-bottom: 8px;
}

.articulo p {
  line-height: 1.7;
}

.articulo ul {
  padding-left: 1.2em;
  margin: 0;
  display: grid;
  gap: 8px;
}

.articulo li::marker {
  color: var(--accent-ink);
}
</style>
