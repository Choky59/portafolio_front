<script setup>
/**
 * Overview: totals, how the city feels, what's being talked about (topics with their
 * emotions), notes per day and the most repeated tags. Topics and tags link to the
 * Noticias view already filtered.
 */
import { computed } from 'vue'
import EstadoCarga from '../../EstadoCarga.vue'
import EstadoError from '../../EstadoError.vue'
import BarraApilada from './BarraApilada.vue'
import Temas from './Temas.vue'
import Totales from './Totales.vue'
import { useApi } from '../../../composables/useApi'
import { getResumen } from '../../../api/pulso'
import { AMBITOS, TIPOS, colorEmocion, dia, nombreEmocion, segmentosEmocion, EMOCIONES } from './catalogo'

const emit = defineEmits(['ir'])
const { data, error, loading, reload } = useApi((signal) => getResumen(signal))

/** Average emotion mix of all notes, as % */
const sentir = computed(() =>
  data.value?.emociones
    ? EMOCIONES.map((e) => ({ clave: e.clave, etiqueta: e.etiqueta, valor: data.value.emociones.promedio[e.clave] ?? 0, color: colorEmocion(e.clave) }))
    : []
)
const dominante = computed(() => {
  const p = data.value?.emociones?.promedio
  if (!p) return null
  return EMOCIONES.map((e) => e.clave).reduce((a, b) => (p[b] > p[a] ? b : a))
})

const temas = computed(() => data.value?.temas ?? [])

const dias = computed(() => data.value?.dias ?? [])
const maxDia = computed(() => Math.max(1, ...dias.value.map((d) => d.notas)))

const repartos = computed(() => {
  const d = data.value
  if (!d) return []
  const lista = (obj, nombres) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => ({ clave: k, etiqueta: nombres[k] ?? k, n }))
  return [
    { titulo: 'Alcance', filas: lista(d.ambitos, AMBITOS), filtro: 'ambito' },
    { titulo: 'Tipo de nota', filas: lista(d.tipos, TIPOS), filtro: 'tipo' },
  ]
})
</script>

<template>
  <EstadoCarga v-if="loading && !data" texto="Cargando el panorama…" />
  <EstadoError v-else-if="error" :error="error" titulo="No se pudo cargar el análisis" @reintentar="reload" />
  <p v-else-if="data && !data.totales.notas" class="muted">Todavía no hay noticias analizadas.</p>

  <div v-else-if="data" class="panorama">
    <Totales :totales="data.totales" sucesos />

    <section class="bloque" aria-labelledby="p-sentir">
      <h2 id="p-sentir" class="bloque__titulo">¿Cómo se siente la ciudad?</h2>
      <p class="muted">
        La mezcla de emociones que estas noticias probablemente provocan en la gente.
        <template v-if="dominante">Predomina <strong>{{ nombreEmocion(dominante).toLowerCase() }}</strong>.</template>
      </p>
      <BarraApilada :segmentos="sentir" leyenda porcentaje :alto="22" />
    </section>

    <section class="bloque" aria-labelledby="p-temas">
      <h2 id="p-temas" class="bloque__titulo">¿De qué se habla?</h2>
      <p class="muted">Cada barra es un tema, repartida según la emoción que domina en cada una de sus noticias. Toca uno para ver sus notas.</p>
      <Temas :temas="temas" @tema="(tema) => emit('ir', 'noticias', { tema })" />
    </section>

    <section v-if="dias.length" class="bloque" aria-labelledby="p-dias">
      <h2 id="p-dias" class="bloque__titulo">Noticias por día</h2>
      <div class="dias" role="list">
        <div v-for="d in dias" :key="d.fecha" class="dia" role="listitem" :aria-label="`${dia(d.fecha)}: ${d.notas} noticias`">
          <span class="dia__n">{{ d.notas }}</span>
          <span class="dia__columna" :style="{ height: `${(d.notas / maxDia) * 100}%` }">
            <span
              v-for="s in segmentosEmocion(d.emociones)"
              :key="s.clave"
              class="dia__parte"
              :style="{ flexGrow: s.valor, background: s.color }"
              :title="`${s.etiqueta}: ${s.valor}`"
            />
          </span>
          <span class="dia__fecha">{{ dia(d.fecha) }}</span>
        </div>
      </div>
    </section>

    <section class="bloque repartos">
      <div v-for="r in repartos" :key="r.titulo">
        <h2 class="bloque__subtitulo">{{ r.titulo }}</h2>
        <ul class="reparto">
          <li v-for="f in r.filas" :key="f.clave">
            <button type="button" class="reparto__fila" @click="emit('ir', 'noticias', { [r.filtro]: f.clave })">
              <span>{{ f.etiqueta }}</span>
              <span class="reparto__barra"><span :style="{ width: `${(f.n / data.totales.notas) * 100}%` }" /></span>
              <strong>{{ f.n }}</strong>
            </button>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="data.etiquetas.length" class="bloque" aria-labelledby="p-etiquetas">
      <h2 id="p-etiquetas" class="bloque__titulo">Lo más mencionado</h2>
      <ul class="chips">
        <li v-for="e in data.etiquetas" :key="e.etiqueta">
          <button type="button" class="chip chip--boton" @click="emit('ir', 'noticias', { q: e.etiqueta })">
            {{ e.etiqueta }} <span class="muted">{{ e.notas }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.bloque {
  margin-top: 40px;
}

.bloque__titulo {
  font-size: clamp(1.7rem, 5.5vw, 2.2rem);
}

.bloque__subtitulo {
  font-size: 1.4rem;
  margin-bottom: 8px;
}

.reparto {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  gap: 4px;
}

.reparto__fila {
  display: grid;
  align-items: center;
  gap: 4px 12px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.reparto__fila:hover {
  background: var(--surface);
}

.dias {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 200px;
  margin-top: 12px;
  padding-bottom: 4px;
  overflow-x: auto;
}

.dia {
  flex: 1 0 44px;
  max-width: 80px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.dia__columna {
  width: 100%;
  min-height: 4px;
  display: flex;
  flex-direction: column-reverse;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  border: 1.5px solid var(--border);
}

.dia__parte {
  flex-basis: 0;
}

.dia__n {
  font-weight: 700;
  font-size: 0.85rem;
}

.dia__fecha {
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
}

.repartos {
  display: grid;
  gap: 24px;
}

@media (min-width: 720px) {
  .repartos {
    grid-template-columns: 1fr 1fr;
  }
}

.reparto__fila {
  grid-template-columns: minmax(120px, 40%) 1fr 32px;
}

.reparto__barra {
  height: 10px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.reparto__barra span {
  display: block;
  height: 100%;
  background: var(--accent);
}

.reparto__fila strong {
  text-align: right;
}

.chip--boton {
  border: 1px solid var(--border);
  cursor: pointer;
  font: inherit;
  color: var(--text);
}
</style>
