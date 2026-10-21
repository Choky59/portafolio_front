<script setup>
/**
 * People and institutions that appear most in the news (never minors), with the average
 * tone of the coverage toward them. A name opens its notes.
 */
import { computed, ref } from 'vue'
import EstadoCarga from '../../EstadoCarga.vue'
import EstadoError from '../../EstadoError.vue'
import BarraTono from './BarraTono.vue'
import { useApi } from '../../../composables/useApi'
import { getActores } from '../../../api/pulso'
import { NIVELES, nombreTema } from './catalogo'

const emit = defineEmits(['ir'])
const { data, error, loading, reload } = useApi((signal) => getActores(signal, 40))

const TIPOS = {
  todos: 'Todos',
  personas: 'Personas',
  instituciones: 'Instituciones',
}
const tipo = ref('todos')
const esPersona = (a) => a.tipo === 'persona' || a.tipo === 'funcionario'
const actores = computed(() =>
  (data.value?.actores ?? []).filter((a) => tipo.value === 'todos' || (tipo.value === 'personas') === esPersona(a))
)
const max = computed(() => Math.max(1, ...actores.value.map((a) => a.menciones)))
const temaPrincipal = (a) => Object.entries(a.temas).sort((x, y) => y[1] - x[1])[0]?.[0]
/** "Gobernador de Sonora · Justicia" (only the parts it has) */
const detalle = (a) =>
  [a.cargo || (a.nivelGobierno ? `Gobierno ${NIVELES[a.nivelGobierno].toLowerCase()}` : ''), temaPrincipal(a) ? nombreTema(temaPrincipal(a)) : '']
    .filter(Boolean)
    .join(' · ')
</script>

<template>
  <EstadoCarga v-if="loading && !data" texto="Cargando actores…" />
  <EstadoError v-else-if="error" :error="error" titulo="No se pudieron cargar los actores" @reintentar="reload" />
  <div v-else-if="data">
    <h2 class="bloque__titulo">¿Quién aparece en las noticias?</h2>
    <p class="muted intro">
      Las personas e instituciones más mencionadas y el tono promedio de las noticias hacia ellas. Toca un nombre para ver
      sus notas.
    </p>

    <div class="tipos" role="group" aria-label="Tipo de actor">
      <button v-for="(nombre, clave) in TIPOS" :key="clave" type="button" class="chip chip--boton" :aria-pressed="tipo === clave" @click="tipo = clave">
        {{ nombre }}
      </button>
    </div>

    <p v-if="!actores.length" class="muted">Todavía no hay actores para mostrar.</p>
    <ol class="actores">
      <li v-for="a in actores" :key="a.nombre" class="actor">
        <div class="actor__quien">
          <button type="button" class="actor__nombre" @click="emit('ir', 'noticias', { actor: a.nombre })">{{ a.nombre }}</button>
          <span class="muted actor__detalle">{{ detalle(a) }}</span>
        </div>
        <div class="actor__menciones" :aria-label="`${a.menciones} menciones en ${a.medios} medios`">
          <span class="actor__barra" :style="{ width: `${(a.menciones / max) * 100}%` }" />
          <span class="actor__n">{{ a.menciones }}<small class="muted"> · {{ a.medios }} {{ a.medios === 1 ? 'medio' : 'medios' }}</small></span>
        </div>
        <BarraTono :valor="a.tono" :etiqueta="`Tono hacia ${a.nombre}`" />
      </li>
    </ol>
  </div>
</template>

<style scoped>
.bloque__titulo {
  font-size: clamp(1.7rem, 5.5vw, 2.2rem);
}

.intro {
  max-width: 70ch;
}

.tipos {
  display: flex;
  gap: 6px;
  margin: 16px 0;
}

.chip--boton {
  border: 1px solid var(--border);
  cursor: pointer;
  font: inherit;
  color: var(--text);
}

.chip--boton[aria-pressed='true'] {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}

.actores {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 2px;
}

.actor {
  display: grid;
  gap: 6px 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

@media (min-width: 820px) {
  .actor {
    grid-template-columns: minmax(220px, 1.2fr) 1fr 1fr;
    align-items: center;
  }
}

.actor__nombre {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  font: 700 1rem var(--font-body);
  text-align: left;
  cursor: pointer;
}

.actor__nombre:hover {
  color: var(--accent-ink);
  text-decoration: underline;
}

.actor__detalle {
  display: block;
  font-size: 0.8rem;
}

.actor__menciones {
  display: flex;
  align-items: center;
  gap: 8px;
}

.actor__barra {
  height: 10px;
  min-width: 4px;
  border-radius: 999px;
  background: var(--accent);
}

.actor__n {
  font-weight: 700;
  font-size: 0.9rem;
  white-space: nowrap;
}
</style>
