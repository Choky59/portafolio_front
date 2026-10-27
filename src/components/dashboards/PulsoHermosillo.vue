<script setup>
/**
 * "El pulso de Hermosillo": crowd gathered around the city's news, colored by the
 * emotion each one causes: the analysis' totals, the 3D scene with its tour (title,
 * emotions and buttons) and the news modal. Used in the project's "En vivo" block.
 */
import { computed, ref } from 'vue'
import ThreeCanvas from '../ThreeCanvas.vue'
import ModalNoticia from '../pulso/ModalNoticia.vue'
import { usePulso } from '../../composables/usePulso'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useApi } from '../../composables/useApi'
import { getResumen } from '../../api/pulso'
import Totales from '../analisis/pulso/Totales.vue'
import { EMOCIONES, iconoFuente } from '../../three/pulso/emociones'

const { noticias, esDemo, seleccionId, seleccion, agotadas, cargando, cargarMas } = usePulso()

// The totals over the scene (a failed request just shows nothing)
const resumen = useApi((signal) => getResumen(signal))
const totales = computed(() => (resumen.data.value?.totales?.notas ? resumen.data.value.totales : null))

const tactil = useMediaQuery('(pointer: coarse)')
const cargarEscena = () => import('../../three/escenas/pulso-hermosillo.js')

// The tour (see escenas/pulso-hermosillo.js): the news the camera is on, and the buttons' commands
const foco = ref({ noticia: null, atras: false, ultima: false, recorrido: false })
const comando = ref(null)
let nComando = 0
function ordenar(tipo) {
  comando.value = { tipo, n: ++nComando }
}

const params = computed(() => ({
  noticias: noticias.value,
  seleccionId: seleccionId.value,
  comando: comando.value,
  onSeleccion: (id) => (seleccionId.value = id),
  onFoco: (f) => (foco.value = f),
}))

const enRecorrido = computed(() => foco.value.recorrido)
// On the last news never shown, "Siguiente" loads older news first (when there are more)
const conMas = computed(() => foco.value.ultima && !esDemo.value && !agotadas.value)

async function siguiente() {
  if (conMas.value) await cargarMas()
  ordenar('siguiente')
}

/** The focused news' emotions, top to bottom, as shares of the people who react (no neutral) */
const barra = computed(() => {
  const mezcla = foco.value.noticia?.sentimiento?.emociones ?? {}
  const lista = EMOCIONES.filter((e) => e.clave !== 'neutral').map((e) => ({ ...e, valor: mezcla[e.clave] ?? 0 }))
  const suma = lista.reduce((a, e) => a + e.valor, 0)
  // Shares of 1: flex-grow values that add up to less than 1 would leave part of the bar empty (white, like "neutral")
  return suma > 0 ? lista.filter((e) => e.valor > 0).map((e) => ({ ...e, parte: e.valor / suma, pct: Math.round((e.valor / suma) * 100) })) : []
})

const ayuda = computed(() => {
  const accion = tactil.value ? 'Toca' : 'Haz clic en'
  return `La gente corre a las noticias que le interesan y se pinta de lo que siente. Las noticias van cambiando y la cámara visita cada una: usa los botones para ir a la anterior o a la siguiente y, en la última, para cargar más; «Reiniciar» regresa a todos a la fila. Con «Ver más» abres la noticia completa; ${accion.toLowerCase()} una persona para oír qué dice.`
})
</script>

<template>
  <div class="pulso">
    <Totales v-if="totales" :totales="totales" />

    <div class="escena">
      <ThreeCanvas :cargar="cargarEscena" :params="params" interactivo>
        <template #poster>
          <div class="escena__poster" />
        </template>
      </ThreeCanvas>

      <p v-if="esDemo" class="escena__demo">Noticias de ejemplo (ficticias)</p>

      <!-- The tour: the focused news' title on top (out of the crowd's way), its emotions on the side, the buttons below -->
      <template v-if="enRecorrido">
        <Transition name="foco">
          <div v-if="foco.noticia" :key="foco.noticia.id" class="foco">
            <span class="foco__fuente">
              <span aria-hidden="true">{{ iconoFuente(foco.noticia.fuente?.tipo) }}</span> {{ foco.noticia.fuente?.nombre }}
            </span>
            <p class="foco__titulo">{{ foco.noticia.titulo }}</p>
            <button
              type="button"
              class="btn btn--sm foco__mas"
              :aria-label="`Ver más: ${foco.noticia.titulo}`"
              @click="seleccionId = foco.noticia.id"
            >
              Ver más
            </button>
          </div>
        </Transition>

        <div
          v-if="foco.noticia && barra.length"
          class="emociones"
          role="img"
          :aria-label="barra.map((e) => `${e.etiqueta} ${e.pct}%`).join(', ')"
        >
          <div class="emociones__barra">
            <span
              v-for="e in barra"
              :key="e.clave"
              class="emociones__parte"
              :style="{ flexGrow: e.parte, background: `var(--emo-${e.clave})` }"
            />
          </div>
          <ul class="emociones__leyenda" aria-hidden="true">
            <li v-for="e in barra" :key="e.clave" :style="{ flexGrow: e.parte }">
              <span class="emociones__etiqueta">{{ e.etiqueta }} <strong>{{ e.pct }}%</strong></span>
            </li>
          </ul>
        </div>

        <div class="recorrido" role="group" aria-label="Recorrer las noticias">
          <button type="button" class="btn btn--sm recorrido__btn" :disabled="!foco.atras" @click="ordenar('anterior')">
            ‹ Anterior
          </button>
          <button
            v-if="conMas"
            type="button"
            class="btn btn--sm recorrido__btn recorrido__btn--mas"
            :disabled="cargando"
            @click="siguiente"
          >
            {{ cargando ? 'Cargando…' : 'Cargar más noticias' }}
          </button>
          <button v-else type="button" class="btn btn--sm recorrido__btn" @click="siguiente">Siguiente ›</button>
        </div>

        <button
          type="button"
          class="fila"
          title="Todos de regreso a la fila"
          aria-label="Reiniciar: todos de regreso a la fila"
          @click="ordenar('fila')"
        >
          <span aria-hidden="true">↺</span> Reiniciar
        </button>
      </template>

    </div>

    <!-- Outside the scene: a full-screen modal with the note's whole analysis -->
    <ModalNoticia v-if="seleccion" :noticia="seleccion" :es-demo="esDemo" @cerrar="seleccionId = null" />

    <p class="pie muted">
      {{ ayuda }}
    </p>
  </div>
</template>

<style scoped>
.pulso {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.pie {
  font-size: 0.85rem;
  margin: 0;
}

/* ---------- the tour: title, emotions and buttons over the scene ---------- */
.foco {
  position: absolute;
  z-index: 2;
  top: 40px; /* below the demo label */
  left: 50%;
  transform: translateX(-50%);
  width: min(520px, calc(100% - 24px));
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: 'fuente fuente' 'titulo mas';
  align-items: end;
  gap: 2px 12px;
  padding: 8px 10px 10px 14px;
  border: 2.5px solid #1c1c1c;
  border-radius: 14px;
  background: #fffdf7;
  color: #1c1c1c;
  box-shadow: 0 3px 0 #1c1c1c;
}

.foco__fuente {
  grid-area: fuente;
  font-size: 0.75rem;
  font-weight: 600;
  color: #5a5a5a;
}

.foco__titulo {
  grid-area: titulo;
  margin: 0;
  font: 700 1rem/1.3 var(--font-body);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.foco__mas {
  grid-area: mas;
  background: #1c1c1c;
  border-color: #1c1c1c;
  color: #fff;
  white-space: nowrap;
}

.foco-enter-active,
.foco-leave-active {
  transition: opacity 0.35s ease;
}

.foco-enter-from,
.foco-leave-to {
  opacity: 0;
}

.emociones {
  position: absolute;
  z-index: 2;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  height: min(46%, 260px);
  display: flex;
  flex-direction: row-reverse;
  gap: 6px;
  pointer-events: none;
}

.emociones__barra {
  width: 14px;
  display: flex;
  flex-direction: column;
  border: 2px solid #1c1c1c;
  border-radius: 999px;
  overflow: hidden;
  background: #fff;
}

.emociones__parte {
  flex-basis: 0;
  transition: flex-grow 0.5s ease;
}

.emociones__leyenda {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.emociones__leyenda li {
  flex-basis: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.emociones__etiqueta {
  padding: 1px 6px;
  border-radius: 6px;
  background: rgb(255 253 247 / 0.85);
  color: #1c1c1c;
  font-size: 0.7rem;
  white-space: nowrap;
}

.recorrido {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 999px;
  background: rgb(255 253 247 / 0.9);
  border: 2px solid #1c1c1c;
}

.recorrido__btn {
  background: #1c1c1c;
  border-color: #1c1c1c;
  color: #fff;
  white-space: nowrap;
}

.recorrido__btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.recorrido__btn--mas {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}

.fila {
  position: absolute;
  z-index: 2;
  left: 10px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 2px 10px;
  border: 2px solid #1c1c1c;
  border-radius: 999px;
  background: rgb(255 253 247 / 0.9);
  color: #1c1c1c;
  font: 700 0.75rem var(--font-body);
  cursor: pointer;
}

/* Phones: just the icon, so it doesn't run into the tour buttons */
@media (max-width: 520px) {
  .fila {
    width: 36px;
    height: 36px;
    padding: 0;
    justify-content: center;
    font-size: 0;
  }

  .fila span {
    font-size: 1.1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .foco-enter-active,
  .foco-leave-active,
  .emociones__parte {
    transition: none;
  }
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
  /* Hidden until the scene shows it (only the clicked news) */
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease, background 0.2s ease;
}

/* Phones: every title is always on the map, so the cards get smaller to overlap less */
@media (max-width: 520px) {
  .escena :deep(.pulso-etiqueta) {
    max-width: 136px;
    gap: 4px;
    padding: 4px 7px;
    border-width: 2px;
    border-radius: 10px;
    font-size: 0.7rem;
    box-shadow: 0 2px 0 #1c1c1c;
  }
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
