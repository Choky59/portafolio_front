<script setup>
/**
 * Map of the news (Leaflet + OpenStreetMap), two layers:
 * - Noticias: one marker per place where something happened, colored by the emotion
 *   of its note; approximate places (a colony, or blurred on purpose) look fainter.
 * - Por colonia: one circle per colony, sized by its number of notes and colored by its
 *   dominant emotion (or by polarity, negative to positive).
 * Topic and emotion filters apply to both. Leaflet only loads with this view.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import EstadoError from '../../EstadoError.vue'
import { useApi } from '../../../composables/useApi'
import { getMapa, getMapaColonias } from '../../../api/pulso'
import { EMOCIONES, TEMAS, colorEmocion, fecha, nombreEmocion, nombreTema } from './catalogo'

const emit = defineEmits(['ir'])
const HERMOSILLO = [29.085, -110.96]

const capa = ref('noticias') // noticias | colonias
const colorear = ref('emocion') // emocion | polaridad (colonias layer)
const filtros = ref({ tema: '', emocion: '' })
const params = computed(() => Object.fromEntries(Object.entries(filtros.value).filter(([, v]) => v)))

const { data: puntos, error, loading, reload } = useApi((signal) => getMapa(params.value, signal))
const { data: colonias, reload: recargarColonias } = useApi((signal) => getMapaColonias(params.value, signal))
watch(params, () => {
  reload()
  recargarColonias()
})

const features = computed(() => puntos.value?.features ?? [])
const notasEnMapa = computed(() => new Set(features.value.map((f) => f.properties.notaId)).size)

/* ---------- Leaflet ---------- */

const contenedor = ref(null)
let mapa = null
let grupo = null

/** CSS variable -> real color (Leaflet paints SVG with plain colors) */
function color(variable) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable.slice(4, -1)).trim() || '#999'
}
const OPACIDAD = { cruce: 0.95, lugar: 0.95, direccion: 0.95, colonia: 0.55, aproximada: 0.5 }

/** -1 red ... 0 gray ... 1 green */
function colorPolaridad(p) {
  if (p === null || p === undefined) return '#999'
  const a = Math.min(1, Math.abs(p))
  return p < 0 ? `rgba(228, 87, 46, ${0.35 + a * 0.65})` : `rgba(80, 160, 120, ${0.35 + a * 0.65})`
}

function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function popupNota(p) {
  const enlace = p.enlace ? `<a href="${escapar(p.enlace)}" target="_blank" rel="noopener">${p.enlace.includes('youtu') ? '▶ Ver en el minuto' : 'Leer la nota'} ↗</a>` : ''
  const precision = p.precision === 'aproximada' ? ' · ubicación aproximada a propósito' : p.precision === 'colonia' ? ' · aproximado (colonia)' : ''
  return `<strong>${escapar(p.titulo)}</strong><br><span class="pop-meta">${escapar(nombreTema(p.tema))} · ${escapar(nombreEmocion(p.emocion))} · ${escapar(fecha(p.publicadoEn))}</span><br>
    <span class="pop-meta">📍 ${escapar(p.mencion)}${precision}</span><br>${enlace}`
}

function dibujar() {
  if (!mapa) return
  grupo.clearLayers()
  const limites = []
  if (capa.value === 'noticias') {
    for (const f of features.value) {
      const [lon, lat] = f.geometry.coordinates
      const p = f.properties
      L.circleMarker([lat, lon], {
        radius: 6 + 8 * (p.relevancia ?? 0.5),
        color: '#1c1c1c',
        weight: 1.5,
        fillColor: color(colorEmocion(p.emocion)),
        fillOpacity: OPACIDAD[p.precision] ?? 0.6,
        dashArray: p.precision === 'aproximada' ? '3 3' : null,
      })
        .bindPopup(popupNota(p))
        .addTo(grupo)
      limites.push([lat, lon])
    }
  } else {
    const lista = colonias.value?.colonias ?? []
    const max = Math.max(1, ...lista.map((c) => c.notas))
    for (const c of lista) {
      const [lon, lat] = c.punto.coordinates
      const dominante = Object.entries(c.emociones).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'alegria'
      L.circle([lat, lon], {
        radius: 250 + 900 * Math.sqrt(c.notas / max),
        color: '#1c1c1c',
        weight: 1.5,
        fillColor: colorear.value === 'emocion' ? color(colorEmocion(dominante)) : colorPolaridad(c.polaridad),
        fillOpacity: 0.6,
      })
        .bindPopup(`<strong>${escapar(c.colonia)}</strong><br>${c.notas} ${c.notas === 1 ? 'noticia' : 'noticias'} · domina ${escapar(nombreEmocion(dominante).toLowerCase())}<br><span class="pop-meta">Tono promedio ${c.polaridad === null ? 's/d' : c.polaridad.toFixed(2)}</span>`)
        .addTo(grupo)
      limites.push([lat, lon])
    }
  }
  if (limites.length) mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 14 })
}

onMounted(async () => {
  await nextTick()
  mapa = L.map(contenedor.value, { scrollWheelZoom: false }).setView(HERMOSILLO, 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa)
  grupo = L.layerGroup().addTo(mapa)
  // Wheel zoom only after the map is clicked, so the page keeps scrolling
  mapa.on('click', () => mapa.scrollWheelZoom.enable())
  mapa.on('mouseout', () => mapa.scrollWheelZoom.disable())
  dibujar()
})
onBeforeUnmount(() => mapa?.remove())
watch([features, () => colonias.value, capa, colorear], dibujar)
</script>

<template>
  <div class="mapa-vista">
    <h2 class="bloque__titulo">¿Dónde pasa?</h2>
    <p class="muted intro">
      Cada punto es un lugar donde ocurrió una noticia, del color de la emoción que provoca. Los puntos tenues son
      aproximados (solo se sabe la colonia). En notas sobre delitos contra personas, la ubicación se difumina a propósito.
    </p>

    <div class="controles">
      <div class="capas" role="group" aria-label="Capa del mapa">
        <button type="button" class="chip chip--boton" :aria-pressed="capa === 'noticias'" @click="capa = 'noticias'">Noticias</button>
        <button type="button" class="chip chip--boton" :aria-pressed="capa === 'colonias'" @click="capa = 'colonias'">Por colonia</button>
      </div>
      <label class="filtro">
        <span>Tema</span>
        <select v-model="filtros.tema">
          <option value="">Todos</option>
          <option v-for="(nombre, clave) in TEMAS" :key="clave" :value="clave">{{ nombre }}</option>
        </select>
      </label>
      <label class="filtro">
        <span>Emoción</span>
        <select v-model="filtros.emocion">
          <option value="">Todas</option>
          <option v-for="e in EMOCIONES" :key="e.clave" :value="e.clave">{{ e.etiqueta }}</option>
        </select>
      </label>
      <label v-if="capa === 'colonias'" class="filtro">
        <span>Color</span>
        <select v-model="colorear">
          <option value="emocion">Emoción dominante</option>
          <option value="polaridad">Tono (negativo ↔ positivo)</option>
        </select>
      </label>
    </div>

    <EstadoError v-if="error" :error="error" titulo="No se pudo cargar el mapa" @reintentar="reload" />
    <div ref="contenedor" class="mapa" role="region" aria-label="Mapa de noticias de Hermosillo" />
    <p class="muted nota-mapa" aria-live="polite">
      <template v-if="loading">Cargando…</template>
      <template v-else-if="capa === 'noticias'">
        {{ features.length }} {{ features.length === 1 ? 'lugar' : 'lugares' }} de {{ notasEnMapa }} {{ notasEnMapa === 1 ? 'noticia' : 'noticias' }}.
        Las noticias sin un lugar preciso en Hermosillo no aparecen en el mapa.
      </template>
      <template v-else>{{ colonias?.colonias?.length ?? 0 }} colonias con noticias.</template>
      <button v-if="filtros.tema || filtros.emocion" type="button" class="enlace" @click="emit('ir', 'noticias', params)">Ver esas noticias en lista →</button>
    </p>

    <ul class="leyenda" aria-label="Colores">
      <li v-for="e in EMOCIONES" :key="e.clave"><span class="punto" :style="{ background: colorEmocion(e.clave) }" aria-hidden="true" /> {{ e.etiqueta }}</li>
    </ul>
  </div>
</template>

<style scoped>
.bloque__titulo {
  font-size: clamp(1.7rem, 5.5vw, 2.2rem);
}

.intro {
  max-width: 72ch;
}

.controles {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 16px;
  margin: 14px 0;
}

.capas {
  display: flex;
  gap: 6px;
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

.filtro {
  display: grid;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.filtro select {
  min-height: 38px;
  padding: 4px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: 500 0.95rem var(--font-body);
  text-transform: none;
  letter-spacing: 0;
}

.mapa {
  height: min(65vh, 560px);
  min-height: 380px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  overflow: hidden;
  z-index: 0;
}

.nota-mapa {
  font-size: 0.85rem;
  margin: 8px 0 0;
}

.enlace {
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.leyenda {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 0.85rem;
}

.punto {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid #1c1c1c;
  vertical-align: -1px;
}

/* Leaflet popups (outside the component's scope) */
.mapa :deep(.leaflet-popup-content) {
  font: 0.9rem/1.4 var(--font-body);
}

.mapa :deep(.pop-meta) {
  color: #555;
  font-size: 0.8rem;
}
</style>
