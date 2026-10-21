<script setup>
/**
 * Every analyzed news item with filters: topic (and subtopic), emotion, outlet, scope,
 * person and free text. The filters are the URL's query (shareable, back button),
 * and the list loads 20 at a time.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EstadoCarga from '../../EstadoCarga.vue'
import EstadoError from '../../EstadoError.vue'
import NotaTarjeta from './NotaTarjeta.vue'
import { useApi } from '../../../composables/useApi'
import { getFuentes, getNotas } from '../../../api/pulso'
import { AMBITOS, EMOCIONES, SUBTEMAS, TEMAS, nombreSubtema } from './catalogo'

const route = useRoute()
const router = useRouter()

const CAMPOS = ['tema', 'subtema', 'emocion', 'fuente', 'ambito', 'tipo', 'actor', 'q']
const filtros = computed(() => Object.fromEntries(CAMPOS.map((c) => [c, typeof route.query[c] === 'string' ? route.query[c] : ''])))
const hayFiltros = computed(() => CAMPOS.some((c) => filtros.value[c]))

/** Changes one or more filters (an empty value removes it); a new topic clears the subtopic */
function poner(cambios) {
  const q = { ...route.query, ...cambios }
  if ('tema' in cambios && !('subtema' in cambios)) delete q.subtema
  for (const c of CAMPOS) if (!q[c]) delete q[c]
  router.replace({ query: { ...q, vista: 'noticias' } })
}
const limpiar = () => router.replace({ query: { vista: 'noticias' } })

// Free text: applied when the person stops typing
const texto = ref(filtros.value.q)
let espera
watch(texto, (v) => {
  clearTimeout(espera)
  espera = setTimeout(() => poner({ q: v.trim().length >= 2 ? v.trim() : '' }), 400)
})
watch(() => filtros.value.q, (v) => (texto.value !== v ? (texto.value = v) : null))

const { data: fuentesData } = useApi((signal) => getFuentes(signal))
const nombres = computed(() => Object.fromEntries((fuentesData.value?.fuentes ?? []).map((f) => [f.slug, f.nombre])))

// Pages: the first one follows the filters; "more" appends the next
const notas = ref([])
const total = ref(0)
const pagina = ref(1)
const { data, error, loading, reload } = useApi((signal) => getNotas({ ...filtros.value, pagina: pagina.value }, signal), { immediate: false })
watch(filtros, () => {
  pagina.value = 1
  notas.value = []
  reload()
}, { immediate: true })
watch(data, (d) => {
  if (!d) return
  total.value = d.total
  notas.value = d.pagina === 1 ? d.notas : [...notas.value, ...d.notas]
})
function masNotas() {
  pagina.value++
  reload()
}

const subtemas = computed(() => SUBTEMAS[filtros.value.tema] ?? [])
</script>

<template>
  <div class="noticias">
    <form class="filtros" role="search" @submit.prevent>
      <label class="filtro filtro--texto">
        <span>Buscar</span>
        <input v-model="texto" type="search" placeholder="agua, Kino, IMSS…" maxlength="100" />
      </label>
      <label class="filtro">
        <span>Tema</span>
        <select :value="filtros.tema" @change="poner({ tema: $event.target.value })">
          <option value="">Todos</option>
          <option v-for="(nombre, clave) in TEMAS" :key="clave" :value="clave">{{ nombre }}</option>
        </select>
      </label>
      <label v-if="subtemas.length" class="filtro">
        <span>Subtema</span>
        <select :value="filtros.subtema" @change="poner({ tema: filtros.tema, subtema: $event.target.value })">
          <option value="">Todos</option>
          <option v-for="s in subtemas" :key="s" :value="s">{{ nombreSubtema(s) }}</option>
        </select>
      </label>
      <label class="filtro">
        <span>Emoción</span>
        <select :value="filtros.emocion" @change="poner({ emocion: $event.target.value })">
          <option value="">Todas</option>
          <option v-for="e in EMOCIONES" :key="e.clave" :value="e.clave">{{ e.etiqueta }}</option>
        </select>
      </label>
      <label class="filtro">
        <span>Medio</span>
        <select :value="filtros.fuente" @change="poner({ fuente: $event.target.value })">
          <option value="">Todos</option>
          <option v-for="f in fuentesData?.fuentes ?? []" :key="f.slug" :value="f.slug">{{ f.nombre }}</option>
        </select>
      </label>
      <label class="filtro">
        <span>Alcance</span>
        <select :value="filtros.ambito" @change="poner({ ambito: $event.target.value })">
          <option value="">Todos</option>
          <option v-for="(nombre, clave) in AMBITOS" :key="clave" :value="clave">{{ nombre }}</option>
        </select>
      </label>
    </form>

    <p class="estado" aria-live="polite">
      <span>{{ loading && !notas.length ? 'Buscando…' : `${total} ${total === 1 ? 'noticia' : 'noticias'}` }}</span>
      <span v-if="filtros.actor" class="chip">Actor: {{ filtros.actor }}</span>
      <span v-if="filtros.tipo" class="chip">Tipo: {{ filtros.tipo.replace('_', ' ') }}</span>
      <button v-if="hayFiltros" type="button" class="btn btn--ghost btn--sm" @click="limpiar">Quitar filtros</button>
    </p>

    <EstadoError v-if="error" :error="error" titulo="No se pudieron cargar las noticias" @reintentar="reload" />
    <EstadoCarga v-else-if="loading && !notas.length" texto="Buscando noticias…" />
    <p v-else-if="!notas.length" class="muted">Ninguna noticia coincide con estos filtros.</p>

    <div class="lista">
      <NotaTarjeta v-for="n in notas" :key="n._id" :nota="n" :nombre-fuente="nombres[n.fuente]" @filtrar="poner" />
    </div>

    <button v-if="notas.length < total" type="button" class="btn mas" :disabled="loading" @click="masNotas">
      {{ loading ? 'Cargando…' : `Ver más (${total - notas.length} restantes)` }}
    </button>
  </div>
</template>

<style scoped>
.filtros {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 900px) {
  .filtros {
    grid-template-columns: 2fr repeat(5, minmax(0, 1fr));
  }
}

.filtro {
  display: grid;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.filtro--texto {
  grid-column: 1 / -1;
}

@media (min-width: 900px) {
  .filtro--texto {
    grid-column: auto;
  }
}

.filtro input,
.filtro select {
  min-height: 40px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: 500 0.95rem var(--font-body);
  text-transform: none;
  letter-spacing: 0;
  min-width: 0;
}

.estado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
  font-weight: 700;
}

.lista {
  display: grid;
  gap: 12px;
}

.mas {
  margin: 20px auto 0;
  display: block;
}
</style>
