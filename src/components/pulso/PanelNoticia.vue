<script setup>
/**
 * Detail of the selected news in "El pulso de Hermosillo": source, summary,
 * tags, people/organizations/places and the emotion breakdown.
 * Side panel on desktop, bottom sheet on phones.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { EMOCIONES, FUENTES } from '../../three/pulso/emociones'

const props = defineProps({
  noticia: { type: Object, required: true },
})
const emit = defineEmits(['cerrar'])

const fuente = computed(() => FUENTES.find((f) => f.clave === props.noticia.fuente?.tipo))

const fecha = computed(() =>
  new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Hermosillo',
  }).format(new Date(props.noticia.fecha))
)

const emociones = computed(() =>
  EMOCIONES.map((e) => ({ ...e, valor: props.noticia.sentimiento?.emociones?.[e.clave] ?? 0 })).filter(
    (e) => e.valor > 0
  )
)

const ICONOS_ENTIDAD = { persona: '👤', organizacion: '🏛️', lugar: '📍' }

function onKey(e) {
  if (e.key === 'Escape') emit('cerrar')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <aside class="panel" aria-labelledby="panel-titulo">
    <button type="button" class="panel__cerrar" aria-label="Cerrar noticia" @click="emit('cerrar')">×</button>

    <p class="panel__fuente">
      <span aria-hidden="true">{{ fuente?.icono }}</span>
      {{ noticia.fuente?.nombre }}<template v-if="noticia.fuente?.programa"> · {{ noticia.fuente.programa }}</template>
    </p>
    <h3 id="panel-titulo" class="panel__titulo">{{ noticia.titulo }}</h3>
    <p class="panel__fecha muted">{{ fecha }} · {{ noticia.categoria }}</p>
    <p>{{ noticia.resumen }}</p>

    <div class="panel__bloque">
      <p class="panel__subtitulo">Cómo se sintió la gente</p>
      <div class="barra" role="img" :aria-label="emociones.map((e) => `${e.etiqueta} ${Math.round(e.valor * 100)}%`).join(', ')">
        <span
          v-for="e in emociones"
          :key="e.clave"
          class="barra__parte"
          :style="{ flexGrow: e.valor, background: `var(--emo-${e.clave})` }"
        />
      </div>
      <ul class="leyenda">
        <li v-for="e in emociones" :key="e.clave">
          <span class="punto" :style="{ background: `var(--emo-${e.clave})` }" aria-hidden="true" />
          {{ e.etiqueta }} {{ Math.round(e.valor * 100) }}%
        </li>
      </ul>
    </div>

    <div v-if="noticia.entidades?.length" class="panel__bloque">
      <p class="panel__subtitulo">Quién y dónde</p>
      <ul class="chips">
        <li v-for="ent in noticia.entidades" :key="ent.nombre" class="chip">
          <span aria-hidden="true">{{ ICONOS_ENTIDAD[ent.tipo] }}</span> {{ ent.nombre }}
        </li>
      </ul>
    </div>

    <div v-if="noticia.tags?.length" class="panel__bloque">
      <p class="panel__subtitulo">Tags</p>
      <ul class="chips">
        <li v-for="tag in noticia.tags" :key="tag" class="chip">#{{ tag }}</li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.panel {
  position: absolute;
  z-index: 3;
  left: 8px;
  right: 8px;
  bottom: 8px;
  max-height: 62%;
  overflow-y: auto;
  background: var(--surface);
  color: var(--text);
  border: 2px solid var(--text);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  padding: 18px 18px 14px;
}

@media (min-width: 820px) {
  .panel {
    left: auto;
    top: 12px;
    right: 12px;
    bottom: 12px;
    width: 340px;
    max-height: none;
  }
}

.panel__cerrar {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
}

.panel__fuente {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 40px 6px 0;
}

.panel__titulo {
  font-size: 1.5rem;
  margin-bottom: 4px;
}

.panel__fecha {
  font-size: 0.85rem;
}

.panel__bloque {
  margin-top: 14px;
}

.panel__subtitulo {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 0 0 6px;
}

.barra {
  display: flex;
  height: 14px;
  border-radius: 999px;
  overflow: hidden;
  border: 2px solid var(--text);
}

.barra__parte {
  flex-basis: 0;
}

.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  font-size: 0.85rem;
}

.punto {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid var(--text);
  margin-right: 2px;
}
</style>
