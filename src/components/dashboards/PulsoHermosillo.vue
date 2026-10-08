<script setup>
/**
 * "El pulso de Hermosillo": crowd gathered around the city's news, colored by the
 * emotion each one causes. Filters + 3D scene + detail panel.
 * Used in the project's "En vivo" block (embebido) and in /explorar (completo).
 */
import { computed } from 'vue'
import ThreeCanvas from '../ThreeCanvas.vue'
import PanelNoticia from '../pulso/PanelNoticia.vue'
import { usePulso } from '../../composables/usePulso'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { EMOCIONES, FUENTES } from '../../three/pulso/emociones'

const props = defineProps({
  modo: { type: String, default: 'embebido' }, // 'embebido' | 'completo'
})

const { noticias, esDemo, filtro, seleccionId, categorias, visibles, seleccion, hayFiltro, limpiarFiltro } =
  usePulso()

const tactil = useMediaQuery('(pointer: coarse)')
const cargarEscena = () => import('../../three/escenas/pulso-hermosillo.js')

const params = computed(() => ({
  noticias: noticias.value,
  filtro: { ...filtro },
  seleccionId: seleccionId.value,
  modo: props.modo,
  onSeleccion: (id) => (seleccionId.value = id),
}))

/** A hidden news can't stay selected */
function revisarSeleccion() {
  if (seleccion.value && !visibles.value.includes(seleccion.value)) seleccionId.value = null
}

function alternar(campo, valor) {
  filtro[campo] = filtro[campo] === valor ? '' : valor
  revisarSeleccion()
}

const ayuda = computed(() => {
  const accion = tactil.value ? 'Toca' : 'Haz clic en'
  const base = `${accion} el piso para gritar desde ahí: la gente cercana lo escuchará y correrá a ver. Grita dentro de una noticia para ver su título y cómo reacciona.`
  if (tactil.value && props.modo === 'embebido') return `${base} Para moverte por el mapa, abre la pantalla completa.`
  if (tactil.value) return `${base} Arrastra para moverte, pellizca para acercar.`
  const zoom = props.modo === 'embebido' ? 'Ctrl/⌘ + rueda' : 'rueda'
  return `${base} Arrastra para moverte, ${zoom} para acercar.`
})
</script>

<template>
  <div class="pulso" :class="`pulso--${modo}`">
    <div class="filtros" role="group" aria-label="Filtros">
      <div class="filtros__grupo">
        <span class="filtros__titulo">Emoción</span>
        <button
          v-for="e in EMOCIONES"
          :key="e.clave"
          type="button"
          class="filtro"
          :aria-pressed="filtro.emocion === e.clave"
          @click="alternar('emocion', e.clave)"
        >
          <span class="punto" :style="{ background: `var(--emo-${e.clave})` }" aria-hidden="true" />
          {{ e.etiqueta }}
        </button>
      </div>

      <div class="filtros__grupo">
        <span class="filtros__titulo">Medio</span>
        <button
          v-for="f in FUENTES"
          :key="f.clave"
          type="button"
          class="filtro"
          :aria-pressed="filtro.fuente === f.clave"
          @click="alternar('fuente', f.clave)"
        >
          <span aria-hidden="true">{{ f.icono }}</span> {{ f.etiqueta }}
        </button>
      </div>

      <div class="filtros__grupo">
        <label class="filtros__titulo" for="pulso-categoria">Tema</label>
        <select id="pulso-categoria" v-model="filtro.categoria" class="filtros__select" @change="revisarSeleccion">
          <option value="">Todos</option>
          <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
        </select>
        <button v-if="hayFiltro" type="button" class="btn btn--ghost btn--sm" @click="limpiarFiltro">Quitar filtros</button>
      </div>
    </div>

    <div class="escena">
      <ThreeCanvas :cargar="cargarEscena" :params="params" interactivo>
        <template #poster>
          <div class="escena__poster" />
        </template>
      </ThreeCanvas>

      <p v-if="esDemo" class="escena__demo">Noticias de ejemplo (ficticias)</p>

      <RouterLink
        v-if="modo === 'embebido'"
        class="btn btn--sm escena__completa"
        to="/proyectos/pulso-hermosillo/explorar"
      >
        Pantalla completa ⤢
      </RouterLink>

      <PanelNoticia v-if="seleccion" :noticia="seleccion" @cerrar="seleccionId = null" />
    </div>

    <p class="pie muted">
      {{ ayuda }}
      <span v-if="hayFiltro" aria-live="polite">{{ visibles.length }} de {{ noticias.length }} noticias coinciden con el filtro.</span>
    </p>
  </div>
</template>

<style scoped>
.pulso {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pulso--completo {
  height: 100%;
}

/* ---------- filters ---------- */
.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
}

.filtros__grupo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.filtros__titulo {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-right: 2px;
}

.filtro {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font: 600 0.85rem var(--font-body);
  cursor: pointer;
}

.filtro[aria-pressed='true'] {
  border-color: var(--text);
  background: var(--surface-2);
}

.filtros__select {
  min-height: 36px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: 600 0.85rem var(--font-body);
}

.punto {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid #1c1c1c;
}

/* ---------- scene ---------- */
.escena {
  position: relative;
  height: min(70vh, 640px);
  min-height: 420px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  overflow: hidden;
  /* Paper white in both themes: the scene is a pencil drawing (src/three/pulso/lapiz.js) */
  background: #fbfaf6;
}

.pulso--completo .escena {
  flex: 1;
  height: auto;
  min-height: 0;
}

.escena__poster {
  width: 100%;
  height: 100%;
  background: #fbfaf6;
}

.escena__demo {
  position: absolute;
  z-index: 2;
  top: 10px;
  left: 10px;
  margin: 0;
  padding: 3px 10px;
  border-radius: 999px;
  border: 2px solid #1c1c1c;
  background: #fff;
  color: #1c1c1c;
  font-size: 0.75rem;
  font-weight: 700;
  pointer-events: none;
}

.escena__completa {
  position: absolute;
  z-index: 2;
  top: 8px;
  right: 8px;
  background: #1c1c1c;
  border-color: #1c1c1c;
  color: #fff;
}

.pie {
  font-size: 0.85rem;
  margin: 0;
}

/* ---------- HTML layer created by the scene (src/three/pulso/burbujas.js) ---------- */
.escena :deep(.pulso-capa) {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.escena :deep(.pulso-etiqueta),
.escena :deep(.pulso-burbuja) {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  will-change: transform;
}

.escena :deep(.pulso-etiqueta) {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  max-width: 190px;
  padding: 6px 10px;
  border: 2.5px solid #1c1c1c;
  border-radius: 12px;
  background: #fffdf7;
  color: #1c1c1c;
  font: 700 0.8rem/1.25 var(--font-body);
  text-align: left;
  box-shadow: 0 3px 0 #1c1c1c;
  cursor: pointer;
  /* Hidden until the scene shows it (a new news, or the group is near) */
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease, background 0.2s ease;
}

.escena :deep(.pulso-etiqueta--visible) {
  opacity: 1;
  pointer-events: auto;
}

.escena :deep(.pulso-etiqueta__texto) {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.escena :deep(.pulso-etiqueta--activa) {
  background: #1c1c1c;
  color: #fff;
}

.escena :deep(.pulso-etiqueta--visible.pulso-etiqueta--oculta) {
  opacity: 0.3;
}

.escena :deep(.pulso-burbuja) {
  padding: 3px 12px 4px;
  border: 3px solid #1c1c1c;
  border-radius: 16px;
  background: #fff;
  color: #1c1c1c;
  font: 700 0.95rem/1.3 var(--font-body);
  white-space: nowrap;
  opacity: 0;
  margin-top: -10px;
  transition: opacity 0.25s ease;
}

/* Little tail pointing at the head */
.escena :deep(.pulso-burbuja)::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -9px;
  width: 12px;
  height: 12px;
  background: #fff;
  border-right: 3px solid #1c1c1c;
  border-bottom: 3px solid #1c1c1c;
  transform: translateX(-50%) rotate(45deg);
}

.escena :deep(.pulso-burbuja--visible) {
  opacity: 1;
}

.escena :deep(.pulso-burbuja[data-emocion='alegria']) { box-shadow: inset 0 -4px 0 var(--emo-alegria); }
.escena :deep(.pulso-burbuja[data-emocion='enojo']) { box-shadow: inset 0 -4px 0 var(--emo-enojo); }
.escena :deep(.pulso-burbuja[data-emocion='tristeza']) { box-shadow: inset 0 -4px 0 var(--emo-tristeza); }
.escena :deep(.pulso-burbuja[data-emocion='miedo']) { box-shadow: inset 0 -4px 0 var(--emo-miedo); }
.escena :deep(.pulso-burbuja[data-emocion='sorpresa']) { box-shadow: inset 0 -4px 0 var(--emo-sorpresa); }

@media (prefers-reduced-motion: reduce) {
  .escena :deep(.pulso-etiqueta),
  .escena :deep(.pulso-burbuja) {
    transition: none;
  }
}
</style>
