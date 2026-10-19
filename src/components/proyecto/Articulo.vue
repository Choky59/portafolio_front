<script setup>
/**
 * Technical article of a video: [{ titulo, texto, puntos? }], shown as an accordion.
 * Each block is a native <details>: the titles read like an index and a tap opens the
 * text (keyboard and screen readers work out of the box, and the full text stays in
 * the HTML for search engines). The first block starts open.
 * Paragraphs are separated by a blank line. Rendered as plain text (no v-html).
 */
import { computed, ref } from 'vue'

const props = defineProps({
  bloques: { type: Array, required: true },
})

const parrafos = (texto) => texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

// Open/closed state per block, kept in sync with the <details> toggle event
const abiertos = ref(props.bloques.map((_, i) => i === 0))
const todosAbiertos = computed(() => abiertos.value.every(Boolean))

function alternarTodos() {
  const abrir = !todosAbiertos.value
  abiertos.value = abiertos.value.map(() => abrir)
}
</script>

<template>
  <div class="articulo">
    <div v-if="bloques.length > 1" class="articulo__cabecera">
      <span class="muted articulo__cuenta">{{ bloques.length }} temas</span>
      <button type="button" class="btn btn--ghost btn--sm articulo__todo" @click="alternarTodos">
        {{ todosAbiertos ? 'Cerrar todo' : 'Abrir todo' }}
      </button>
    </div>

    <details
      v-for="(b, i) in bloques"
      :key="b.titulo"
      class="articulo__bloque"
      :open="abiertos[i]"
      @toggle="abiertos[i] = $event.target.open"
    >
      <summary class="articulo__titulo">
        <span class="articulo__flecha" aria-hidden="true">▸</span>
        <h3>{{ b.titulo }}</h3>
      </summary>

      <div class="articulo__contenido">
        <p v-for="(p, j) in parrafos(b.texto)" :key="j">{{ p }}</p>
        <ul v-if="b.puntos?.length">
          <li v-for="punto in b.puntos" :key="punto">{{ punto }}</li>
        </ul>
      </div>
    </details>
  </div>
</template>

<style scoped>
.articulo {
  max-width: 42rem;
}

.articulo__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.articulo__cuenta {
  font-size: 0.85rem;
}

.articulo__bloque {
  border-bottom: 1px solid var(--border);
}

.articulo__bloque:first-of-type {
  border-top: 1px solid var(--border);
}

.articulo__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 8px 0;
  cursor: pointer;
  list-style: none; /* hide the default marker; we draw our own arrow */
}

.articulo__titulo::-webkit-details-marker {
  display: none;
}

.articulo__titulo:hover h3 {
  color: var(--accent-ink);
}

.articulo__flecha {
  flex: 0 0 auto;
  color: var(--accent-ink);
  font-size: 0.9rem;
  transition: transform 0.2s ease;
}

.articulo__bloque[open] .articulo__flecha {
  transform: rotate(90deg);
}

.articulo h3 {
  font-size: 1.4rem;
  margin: 0;
}

.articulo__contenido {
  padding: 0 0 18px 24px; /* aligned with the title text, past the arrow */
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

@media (prefers-reduced-motion: reduce) {
  .articulo__flecha {
    transition: none;
  }
}
</style>
