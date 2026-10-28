<script setup>
/**
 * Map of the news (Google Maps), two layers:
 * - Noticias: one point per place where something happened, in the color of its note's
 *   main emotion. Notes at the same spot share a pie: the share of notes with each main
 *   emotion (3 angry and 1 happy: 75% / 25%), with the count in the middle; nearby
 *   points join in a bigger pie until you zoom in. Approximate places (a colony, or blurred
 *   on purpose) look fainter.
 * - Por colonia: one circle per colony, sized by its number of notes and colored by its
 *   dominant emotion (or by polarity, negative to positive).
 * Topic and emotion filters apply to both. Google Maps only loads with this view.
 *
 * On phones the map takes the whole screen (moved to <body>, the page behind doesn't scroll):
 * no filters, one finger moves it and two zoom, the explanation opens in a modal on
 * entering, and a back button returns to where the person was.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import EstadoError from '../../EstadoError.vue'
import { useApi } from '../../../composables/useApi'
import { getMapa, getMapaColonias } from '../../../api/pulso'
import { ERROR_LLAVE, GOOGLE_MAPS_MAP_ID, cargarGoogleMaps, siFallaLaLlave } from '../../../composables/googleMaps'
import { EMOCIONES, TEMAS, colorEmocion, fecha, nombreEmocion, nombreTema } from './catalogo'

const emit = defineEmits(['ir'])
const HERMOSILLO = { lat: 29.085, lng: -110.96 }

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

const EXPLICACION =
  'Cada punto es un lugar donde ocurrió una noticia, del color de la emoción que provoca; el número dice cuántas noticias hay en ese lugar. Los puntos cercanos se juntan en una burbuja hasta que te acercas. Los puntos tenues son aproximados (solo se sabe la colonia). En notas sobre delitos contra personas, la ubicación se difumina a propósito.'

/* ---------- phones: full screen map ---------- */

const router = useRouter()
const consulta = window.matchMedia('(max-width: 720px)')
const movil = ref(consulta.matches)
const alCambiarPantalla = (e) => (movil.value = e.matches)
const ayuda = ref(null)

/** Back to where the person was (or to the analysis' first view when the map was opened directly) */
function regresar() {
  if (window.history.state?.back) router.back()
  else emit('ir', 'panorama')
}

// The page behind the full screen map doesn't scroll
watch(movil, (si) => (document.documentElement.style.overflow = si ? 'hidden' : ''), { immediate: true })
watch(movil, (si) => {
  if (si) capa.value = 'noticias' // the layer switch is hidden on phones
  mapa?.setOptions({ gestureHandling: si ? 'greedy' : 'cooperative', fullscreenControl: !si })
})

/* ---------- Google Maps ---------- */

const contenedor = ref(null)
const errorMapa = ref(null)
let gm = null
let mapa = null
let ventana = null
let agrupador = null
let marcadores = []
let circulos = []

/** CSS variable -> real color (Google paints the colony circles with plain colors) */
function color(variable) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable.slice(4, -1)).trim() || '#999'
}
const APROXIMADA = new Set(['colonia', 'aproximada'])

/** -1 red ... 0 gray ... 1 green */
function colorPolaridad(p) {
  if (p === null || p === undefined) return '#999'
  const a = Math.min(1, Math.abs(p))
  return p < 0 ? `rgba(228, 87, 46, ${0.35 + a * 0.65})` : `rgba(80, 160, 120, ${0.35 + a * 0.65})`
}

function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/**
 * Places at the same spot (within ~10 m: often a colony's center) become one point with
 * a count, instead of points stacked on top of each other. A note counts once per spot.
 */
function agrupar(lista) {
  const grupos = new Map()
  for (const f of lista) {
    const [lng, lat] = f.geometry.coordinates
    const clave = `${lat.toFixed(4)},${lng.toFixed(4)}`
    let g = grupos.get(clave)
    if (!g) grupos.set(clave, (g = { lat, lng, notas: [] }))
    if (!g.notas.some((n) => n.notaId === f.properties.notaId)) g.notas.push(f.properties)
  }
  for (const g of grupos.values()) {
    g.notas.sort((a, b) => (b.relevancia ?? 0) - (a.relevancia ?? 0))
    g.mezcla = sumar(g.notas.map(mezclaNota))
    g.aproximada = g.notas.every((n) => APROXIMADA.has(n.precision))
  }
  return [...grupos.values()]
}

/** A note counts once, for its main emotion */
function mezclaNota(n) {
  return { [n.emocion]: 1 }
}

/** How many notes have each main emotion */
function sumar(mezclas) {
  const suma = Object.fromEntries(EMOCIONES.map((e) => [e.clave, 0]))
  for (const m of mezclas) for (const e of EMOCIONES) suma[e.clave] += m[e.clave] ?? 0
  return suma
}

/** The pie: one slice per emotion, in the catalog order, starting at 12 o'clock */
function pastel(mezcla) {
  const total = Object.values(mezcla).reduce((a, b) => a + b, 0) || 1
  let desde = 0
  const partes = []
  for (const e of EMOCIONES) {
    const v = mezcla[e.clave] ?? 0
    if (v <= 0) continue
    const hasta = desde + (v / total) * 100
    partes.push(`${colorEmocion(e.clave)} ${desde.toFixed(2)}% ${hasta.toFixed(2)}%`)
    desde = hasta
  }
  return partes.length ? `conic-gradient(${partes.join(', ')})` : '#999'
}

/** "Enojo 75%, Alegría 25%" (share of notes by main emotion) for the tooltip and screen readers */
function porcentajes(mezcla) {
  const total = Object.values(mezcla).reduce((a, b) => a + b, 0) || 1
  return EMOCIONES.map((e) => [e.etiqueta, Math.round(((mezcla[e.clave] ?? 0) / total) * 100)])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([n, v]) => `${n} ${v}%`)
    .join(', ')
}

function lineaNota(p) {
  const enlace = p.enlace ? ` <a href="${escapar(p.enlace)}" target="_blank" rel="noopener">${p.enlace.includes('youtu') ? '▶ minuto' : 'nota'} ↗</a>` : ''
  const precision = p.precision === 'aproximada' ? ' · ubicación aproximada a propósito' : p.precision === 'colonia' ? ' · aproximado (colonia)' : ''
  return `<li><span class="pop-punto" style="background:var(--emo-${escapar(p.emocion)})"></span><strong>${escapar(p.titulo)}</strong>${enlace}
    <br><span class="pop-meta">${escapar(nombreTema(p.tema))} · ${escapar(nombreEmocion(p.emocion))} · ${escapar(fecha(p.publicadoEn))}${precision}</span></li>`
}

function contenidoGrupo(g) {
  const titulo = g.notas.length === 1 ? '' : `<p class="pop-titulo">${g.notas.length} noticias en este lugar</p>`
  return `<div class="pop">${titulo}<p class="pop-meta">📍 ${escapar(g.notas[0].mencion)}</p>
    <p class="pop-meta">${escapar(porcentajes(g.mezcla))}</p><ul>${g.notas.map(lineaNota).join('')}</ul></div>`
}

/**
 * A pie of `mezcla`, `tam` px wide; with `n` (more than one note) a donut with the
 * count in the middle. The mix travels in the element, for the bubbles that join it.
 */
function elementoPastel(clase, mezcla, tam, n) {
  const el = document.createElement('div')
  el.className = clase
  el.style.width = el.style.height = `${tam}px`
  el.style.background = pastel(mezcla)
  el.dataset.mezcla = JSON.stringify(mezcla)
  el.dataset.notas = String(n)
  el.setAttribute('aria-label', porcentajes(mezcla))
  if (n > 1) {
    const centro = document.createElement('span')
    centro.className = 'pastel__n'
    centro.textContent = String(n)
    el.append(centro)
  }
  return el
}

/** The pie of a place: bigger with its relevance and its number of notes */
function elementoPunto(g) {
  const n = g.notas.length
  const tam = Math.round(18 + 8 * (g.notas[0].relevancia ?? 0.5) + Math.min(16, 5 * Math.sqrt(n - 1)))
  return elementoPastel(`pin${g.aproximada ? ' pin--aprox' : ''}`, g.mezcla, tam, n)
}

/** Nearby pies join in a bigger one: all their notes' emotions, and how many notes they hold */
const renderer = {
  render({ markers, position }) {
    const mezcla = sumar(markers.map((m) => JSON.parse(m.content.dataset.mezcla)))
    const notas = markers.reduce((s, m) => s + Number(m.content.dataset.notas), 0)
    const tam = Math.round(36 + Math.min(26, 6 * Math.sqrt(notas)))
    const el = elementoPastel('grupo', mezcla, tam, Math.max(2, notas))
    el.title = `${notas} noticias (${porcentajes(mezcla)}): acércate para separarlas`
    return new gm.marker.AdvancedMarkerElement({ position, content: el, zIndex: 1000 + notas })
  },
}

/* ---------- smooth zoom into a bubble (instead of fitBounds' jump) ---------- */

const DURACION_ZOOM = 900 // ms
const ZOOM_MAX = 17
let animacion = 0

const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) // ease in-out
const mercatorY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

/** Zoom at which `limites` fit the map with `margen` px around (Web Mercator: 256 px world at zoom 0) */
function zoomPara(limites, margen = 60) {
  const ne = limites.getNorthEast()
  const so = limites.getSouthWest()
  const ancho = Math.max(1, contenedor.value.clientWidth - 2 * margen)
  const alto = Math.max(1, contenedor.value.clientHeight - 2 * margen)
  const spanX = Math.max(1e-6, (ne.lng() - so.lng()) / 360)
  const spanY = Math.max(1e-6, (mercatorY(ne.lat()) - mercatorY(so.lat())) / (2 * Math.PI))
  return Math.min(ZOOM_MAX, Math.log2(ancho / 256 / spanX), Math.log2(alto / 256 / spanY))
}

/** Eases the camera to `destino` ({ lat, lng }) and `zoom`, one frame at a time */
function volarA(destino, zoom) {
  cancelAnimationFrame(animacion)
  const c0 = mapa.getCenter()
  const desde = { lat: c0.lat(), lng: c0.lng(), zoom: mapa.getZoom() }
  // At least one step closer, so a click always zooms in
  const hasta = { ...destino, zoom: Math.max(desde.zoom + 1, Math.min(ZOOM_MAX, zoom)) }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return mapa.moveCamera({ center: destino, zoom: hasta.zoom })
  const inicio = performance.now()
  const paso = (ahora) => {
    const t = Math.min(1, (ahora - inicio) / DURACION_ZOOM)
    const k = suave(t)
    mapa.moveCamera({
      center: { lat: desde.lat + (hasta.lat - desde.lat) * k, lng: desde.lng + (hasta.lng - desde.lng) * k },
      zoom: desde.zoom + (hasta.zoom - desde.zoom) * k,
    })
    if (t < 1) animacion = requestAnimationFrame(paso)
  }
  animacion = requestAnimationFrame(paso)
}

function alClicGrupo(_evento, grupo) {
  ventana?.close()
  const limites = grupo.bounds ?? new gm.LatLngBounds(grupo.position, grupo.position)
  const centro = limites.getCenter()
  volarA({ lat: centro.lat(), lng: centro.lng() }, zoomPara(limites))
}

function limpiar() {
  cancelAnimationFrame(animacion)
  ventana?.close()
  agrupador?.clearMarkers()
  for (const m of marcadores) m.map = null
  marcadores = []
  for (const c of circulos) c.setMap(null)
  circulos = []
}

function encuadrar(limites) {
  if (limites.isEmpty()) return
  mapa.fitBounds(limites, 48)
  // Don't zoom in all the way when there's a single point
  gm.event.addListenerOnce(mapa, 'idle', () => mapa.getZoom() > 15 && mapa.setZoom(15))
}

function dibujar() {
  if (!mapa || errorMapa.value) return
  limpiar()
  const limites = new gm.LatLngBounds()
  if (capa.value === 'noticias') {
    marcadores = agrupar(features.value).map((g) => {
      const m = new gm.marker.AdvancedMarkerElement({
        position: { lat: g.lat, lng: g.lng },
        content: elementoPunto(g),
        title: `${g.notas.length === 1 ? g.notas[0].titulo : `${g.notas.length} noticias en ${g.notas[0].mencion}`} · ${porcentajes(g.mezcla)}`,
        zIndex: g.notas.length,
        gmpClickable: true,
      })
      m.addListener('gmp-click', () => {
        ventana.setContent(contenidoGrupo(g))
        ventana.open({ map: mapa, anchor: m })
      })
      limites.extend(m.position)
      return m
    })
    agrupador.addMarkers(marcadores)
  } else {
    const lista = colonias.value?.colonias ?? []
    const max = Math.max(1, ...lista.map((c) => c.notas))
    for (const c of lista) {
      const [lng, lat] = c.punto.coordinates
      const dom = Object.entries(c.emociones).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'alegria'
      const circulo = new gm.Circle({
        map: mapa,
        center: { lat, lng },
        radius: 250 + 900 * Math.sqrt(c.notas / max),
        strokeColor: '#fffdf7',
        strokeWeight: 1.5,
        fillColor: colorear.value === 'emocion' ? color(colorEmocion(dom)) : colorPolaridad(c.polaridad),
        fillOpacity: 0.6,
      })
      circulo.addListener('click', () => {
        ventana.setContent(
          `<div class="pop"><p class="pop-titulo">${escapar(c.colonia)}</p>${c.notas} ${c.notas === 1 ? 'noticia' : 'noticias'} · domina ${escapar(nombreEmocion(dom).toLowerCase())}<br><span class="pop-meta">Tono promedio ${c.polaridad === null ? 's/d' : c.polaridad.toFixed(2)}</span></div>`
        )
        ventana.setPosition({ lat, lng })
        ventana.open({ map: mapa })
      })
      circulos.push(circulo)
      limites.extend({ lat, lng })
    }
  }
  encuadrar(limites)
}

// A rejected key leaves Google's map broken: stop drawing on it and say why
let dejarDeEscuchar = null
onMounted(async () => {
  consulta.addEventListener('change', alCambiarPantalla)
  await nextTick()
  if (movil.value) ayuda.value?.showModal()
  dejarDeEscuchar = siFallaLaLlave(() => {
    errorMapa.value = new Error(ERROR_LLAVE)
    agrupador = null
    marcadores = []
    circulos = []
  })
  try {
    gm = await cargarGoogleMaps()
  } catch (err) {
    errorMapa.value = err
    return
  }
  if (!contenedor.value) return // left the view while it loaded
  mapa = new gm.Map(contenedor.value, {
    center: HERMOSILLO,
    zoom: 12,
    mapId: GOOGLE_MAPS_MAP_ID,
    // Dark variant: the Map ID's "Modo oscuro" style (Google Cloud > Map management)
    colorScheme: gm.ColorScheme?.DARK ?? 'DARK',
    // Desktop: Ctrl + wheel to zoom, so the page keeps scrolling. Phones (full screen, nothing
    // to scroll): one finger moves it, pinch zooms
    gestureHandling: movil.value ? 'greedy' : 'cooperative',
    fullscreenControl: !movil.value,
    streetViewControl: false,
    mapTypeControl: false,
    clickableIcons: false,
  })
  ventana = new gm.InfoWindow({ maxWidth: 320 })
  agrupador = new MarkerClusterer({ map: mapa, renderer, algorithmOptions: { maxZoom: 16 }, onClusterClick: alClicGrupo })
  dibujar()
})
onBeforeUnmount(() => {
  consulta.removeEventListener('change', alCambiarPantalla)
  document.documentElement.style.overflow = ''
  dejarDeEscuchar?.()
  if (!errorMapa.value) limpiar()
})
watch([features, () => colonias.value, capa, colorear], dibujar)
</script>

<template>
  <div class="mapa-vista">
    <template v-if="!movil">
      <h2 class="bloque__titulo">¿Dónde pasa?</h2>
      <p class="muted intro">{{ EXPLICACION }}</p>
    </template>

    <div v-if="!movil" class="controles">
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
    <p v-if="errorMapa && !movil" class="aviso-mapa">{{ errorMapa.message }}</p>

    <!-- Phones: the map (with its back button and legend) moves to <body> and fills the screen -->
    <Teleport to="body" :disabled="!movil">
      <div class="marco" :class="{ 'marco--movil': movil }">
        <div ref="contenedor" class="mapa" role="region" aria-label="Mapa de noticias de Hermosillo" />
        <template v-if="movil">
          <button type="button" class="flotante regresar" @click="regresar">‹ Regresar</button>
          <button type="button" class="flotante info" aria-label="Qué muestra el mapa" @click="ayuda?.showModal()">
            ?
          </button>
          <p v-if="errorMapa" class="flotante aviso-flotante">{{ errorMapa.message }}</p>
          <p v-else-if="loading" class="flotante aviso-flotante">Cargando…</p>
          <ul class="flotante leyenda-flotante" aria-label="Colores">
            <li v-for="e in EMOCIONES" :key="e.clave">
              <span class="punto" :style="{ background: colorEmocion(e.clave) }" aria-hidden="true" /> {{ e.etiqueta }}
            </li>
          </ul>
        </template>
      </div>
    </Teleport>

    <dialog v-if="movil" ref="ayuda" class="ayuda" aria-labelledby="mapa-ayuda-titulo" @click.self="ayuda.close()">
      <h2 id="mapa-ayuda-titulo">¿Dónde pasa?</h2>
      <p>{{ EXPLICACION }}</p>
      <button type="button" class="btn" @click="ayuda.close()">Ver el mapa</button>
    </dialog>

    <p v-if="!movil" class="muted nota-mapa" aria-live="polite">
      <template v-if="loading">Cargando…</template>
      <template v-else-if="capa === 'noticias'">
        {{ features.length }} {{ features.length === 1 ? 'lugar' : 'lugares' }} de {{ notasEnMapa }} {{ notasEnMapa === 1 ? 'noticia' : 'noticias' }}.
        Las noticias sin un lugar preciso en Hermosillo no aparecen en el mapa.
      </template>
      <template v-else>{{ colonias?.colonias?.length ?? 0 }} colonias con noticias.</template>
      <button v-if="filtros.tema || filtros.emocion" type="button" class="enlace" @click="emit('ir', 'noticias', params)">Ver esas noticias en lista →</button>
    </p>

    <ul v-if="!movil" class="leyenda" aria-label="Colores">
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

.aviso-mapa {
  margin: 0 0 8px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.9rem;
}

/* ---------- phones: the map fills the screen ---------- */
.marco--movil {
  position: fixed;
  inset: 0;
  z-index: 60; /* over the site's top bar */
  background: #1c1c1c;
}

.marco--movil .mapa {
  height: 100%;
  min-height: 0;
  border: 0;
  border-radius: 0;
}

.flotante {
  position: absolute;
  z-index: 1;
  margin: 0;
  border: 0;
  border-radius: 999px;
  background: rgb(28 28 28 / 0.88);
  color: #fffdf7;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.45);
  font: 700 0.95rem var(--font-body);
}

.regresar,
.info {
  top: calc(12px + env(safe-area-inset-top));
  min-height: 44px;
  cursor: pointer;
}

.regresar {
  left: 12px;
  padding: 0 16px;
}

.info {
  right: 12px;
  width: 44px;
  font-size: 1.1rem;
}

.aviso-flotante {
  top: calc(66px + env(safe-area-inset-top));
  left: 12px;
  right: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 500;
  font-size: 0.85rem;
}

.leyenda-flotante {
  left: 50%;
  bottom: calc(14px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100% - 24px);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px 10px;
  padding: 6px 12px;
  border-radius: 14px;
  list-style: none;
  font-size: 0.75rem;
  font-weight: 600;
}

.leyenda-flotante .punto {
  border-color: #fffdf7;
}

.ayuda {
  max-width: min(420px, calc(100% - 32px));
  padding: 22px;
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
}

.ayuda::backdrop {
  background: rgb(0 0 0 / 0.55);
}

.ayuda h2 {
  margin: 0 0 8px;
  font-size: 1.5rem;
}

.ayuda p {
  margin: 0 0 18px;
  line-height: 1.5;
}

.ayuda .btn {
  width: 100%;
}

/* Points, bubbles and info windows are created by Google Maps inside the map (outside the component's scope).
   The map is always dark, so points and bubbles use fixed light outlines; the info windows stay white. */
.mapa :deep(.pin),
.mapa :deep(.grupo) {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  border: 2px solid #fffdf7;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.65);
  cursor: pointer;
}

.mapa :deep(.grupo) {
  border-width: 3px;
}

/* Donut hole with the number of notes */
.mapa :deep(.pastel__n) {
  display: grid;
  place-items: center;
  width: 56%;
  height: 56%;
  border-radius: 50%;
  background: #1c1c1c;
  color: #fffdf7;
  font: 800 0.68rem/1 var(--font-body);
}

.mapa :deep(.grupo .pastel__n) {
  font-size: 0.82rem;
}

.mapa :deep(.pin--aprox) {
  opacity: 0.6;
  border-style: dashed;
}

.mapa :deep(.pop) {
  max-height: 260px;
  overflow-y: auto;
  color: #1c1c1c;
  font: 0.85rem/1.4 var(--font-body);
}

.mapa :deep(.pop p) {
  margin: 0 0 4px;
}

.mapa :deep(.pop-titulo) {
  font-weight: 800;
}

.mapa :deep(.pop ul) {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.mapa :deep(.pop-punto) {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 5px;
  border-radius: 50%;
  border: 1.5px solid #1c1c1c;
}

.mapa :deep(.pop-meta) {
  color: #555;
  font-size: 0.78rem;
}
</style>
