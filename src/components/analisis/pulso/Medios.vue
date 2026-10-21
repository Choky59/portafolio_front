<script setup>
/**
 * Per outlet: how many notes, what it covers most, the emotions of its news and its
 * tone toward each level of government (only notes that talk about that level count).
 */
import { computed } from 'vue'
import EstadoCarga from '../../EstadoCarga.vue'
import EstadoError from '../../EstadoError.vue'
import BarraApilada from './BarraApilada.vue'
import BarraTono from './BarraTono.vue'
import { useApi } from '../../../composables/useApi'
import { getMedios } from '../../../api/pulso'
import { NIVELES, TONOS, nombreTema, segmentosEmocion } from './catalogo'

const emit = defineEmits(['ir'])
const { data, error, loading, reload } = useApi((signal) => getMedios(signal))
const medios = computed(() => data.value?.medios ?? [])

const principales = (conteo, n = 3) => Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, n)
const tonoPrincipal = (m) => principales(m.tonos, 1)[0]?.[0]
</script>

<template>
  <EstadoCarga v-if="loading && !data" texto="Cargando los medios…" />
  <EstadoError v-else-if="error" :error="error" titulo="No se pudieron cargar los medios" @reintentar="reload" />
  <div v-else-if="data">
    <h2 class="bloque__titulo">Cómo cubre cada medio</h2>
    <p class="muted intro">
      Qué temas cubre más, qué emociones provocan sus noticias y su tono hacia cada nivel de gobierno: de
      <strong>crítico</strong> (izquierda, rojo) a <strong>favorable</strong> (derecha, verde). Solo cuentan las notas que
      hablan de ese nivel.
    </p>

    <ul class="medios">
      <li v-for="m in medios" :key="m.fuente" class="medio card">
        <header class="medio__cabeza">
          <h3 class="medio__nombre">{{ m.nombre }}</h3>
          <button type="button" class="btn btn--ghost btn--sm" @click="emit('ir', 'noticias', { fuente: m.fuente })">
            {{ m.notas }} {{ m.notas === 1 ? 'noticia' : 'noticias' }} →
          </button>
        </header>
        <p v-if="m.medio" class="muted medio__dueno">{{ m.medio }}</p>

        <p class="medio__temas">
          <span class="muted">Más cubre:</span>
          <button
            v-for="[tema, n] in principales(m.temas)"
            :key="tema"
            type="button"
            class="chip chip--boton"
            @click="emit('ir', 'noticias', { fuente: m.fuente, tema })"
          >
            {{ nombreTema(tema) }} <span class="muted">{{ n }}</span>
          </button>
        </p>

        <div class="medio__fila">
          <span class="medio__etiqueta">Emociones</span>
          <BarraApilada :segmentos="segmentosEmocion(m.emociones)" :alto="12" />
        </div>
        <p v-if="tonoPrincipal(m)" class="muted medio__tono">Lo cuenta sobre todo en tono <strong>{{ TONOS[tonoPrincipal(m)]?.toLowerCase() }}</strong>.</p>

        <div class="medio__posturas">
          <div v-for="(nombre, nivel) in NIVELES" :key="nivel" class="medio__fila">
            <span class="medio__etiqueta">
              Gobierno {{ nombre.toLowerCase() }}
              <small class="muted">({{ m.postura[nivel].notas }})</small>
            </span>
            <BarraTono :valor="m.postura[nivel].promedio" :etiqueta="`${m.nombre}, tono hacia el gobierno ${nombre.toLowerCase()}`" />
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.bloque__titulo {
  font-size: clamp(1.7rem, 5.5vw, 2.2rem);
}

.intro {
  max-width: 70ch;
}

.medios {
  list-style: none;
  padding: 0;
  margin: 20px 0 0;
  display: grid;
  gap: 14px;
}

@media (min-width: 900px) {
  .medios {
    grid-template-columns: 1fr 1fr;
  }
}

.medio {
  display: grid;
  gap: 10px;
  padding: 16px;
  align-content: start;
}

.medio__cabeza {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.medio__nombre {
  font-family: var(--font-body);
  font-size: 1.1rem;
  margin: 0;
}

.medio__dueno {
  margin: -6px 0 0;
  font-size: 0.85rem;
}

.medio__temas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.medio__fila {
  display: grid;
  grid-template-columns: 130px 1fr;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
}

.medio__tono {
  margin: 0;
  font-size: 0.85rem;
}

.medio__posturas {
  display: grid;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.chip--boton {
  border: 1px solid var(--border);
  cursor: pointer;
  font: inherit;
  color: var(--text);
}
</style>
