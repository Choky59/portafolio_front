<script setup>
/**
 * Live dashboard for Proyecto #1. Polls the state every 30 s (pauses with the tab
 * hidden, stops when leaving the page) and refreshes the 24 h history every 5 min.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ThreeCanvas from '../ThreeCanvas.vue'
import EstadoCarga from '../EstadoCarga.vue'
import HistorialGrafica from './HistorialGrafica.vue'
import { usePolling } from '../../composables/usePolling'
import { getEstado, getHistorial } from '../../api/sePuedeSalir'
import { mensajeError } from '../../api/client'

const INTERVALO = 30 * 1000
const INTERVALO_HISTORIAL = 5 * 60 * 1000

const estado = ref(null)
const error = ref(null)
const cargando = ref(true)
const historial = ref(null)
let historialEn = 0

usePolling(async (signal) => {
  try {
    estado.value = await getEstado(signal)
    error.value = null
  } catch (err) {
    if (err?.name !== 'AbortError') error.value = err
  } finally {
    cargando.value = false
  }

  if (Date.now() - historialEn > INTERVALO_HISTORIAL) {
    try {
      historial.value = await getHistorial(24, signal)
      historialEn = Date.now()
    } catch {
      // the chart keeps its last data
    }
  }
}, INTERVALO)

/* "hace X s" ticker */
const ahora = ref(Date.now())
let reloj = null
onMounted(() => {
  reloj = setInterval(() => (ahora.value = Date.now()), 5000)
})
onBeforeUnmount(() => clearInterval(reloj))

const relativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

const hace = computed(() => {
  if (!estado.value?.medidoEn) return ''
  const segundos = Math.round((new Date(estado.value.medidoEn).getTime() - ahora.value) / 1000)
  if (segundos > -60) return relativo.format(Math.min(segundos, 0), 'second')
  if (segundos > -3600) return relativo.format(Math.round(segundos / 60), 'minute')
  return relativo.format(Math.round(segundos / 3600), 'hour')
})

const termometro = computed(() => ({
  temperatura: estado.value?.temperatura ?? null,
  color: estado.value?.estado?.color ?? null,
}))

const cargarTermometro = () => import('../../three/escenas/termometro.js')

const leyenda = [
  { emoji: '🧥', etiqueta: '¡Ya, suéter!', rango: '<20°', color: 'var(--frio)' },
  { emoji: '🍃', etiqueta: 'Increíble', rango: '20–30°', color: 'var(--ideal)' },
  { emoji: '😎', etiqueta: 'Se aguanta', rango: '30–35°', color: 'var(--calor)' },
  { emoji: '🔥', etiqueta: 'Mejor ni asomarse', rango: '>35°', color: 'var(--extremo)' },
]
</script>

<template>
  <div class="dashboard card">
    <EstadoCarga v-if="cargando" texto="Consultando el sensor…" />

    <template v-else>
      <div class="dashboard__principal">
        <div class="dashboard__termometro">
          <ThreeCanvas :cargar="cargarTermometro" :params="termometro" />
        </div>

        <div class="dashboard__estado" aria-live="polite">
          <p class="dashboard__vivo muted">Hermosillo, Sonora</p>

          <template v-if="estado?.estado">
            <p class="dashboard__etiqueta" :style="{ color: estado.estado.color }">
              <span aria-hidden="true">{{ estado.estado.emoji }}</span> {{ estado.estado.etiqueta }}
            </p>
            <p class="dashboard__temperatura">
              {{ estado.temperatura.toFixed(1) }} °C
              <span v-if="estado.humedad != null" class="muted dashboard__humedad">
                · {{ Math.round(estado.humedad) }}% humedad
              </span>
            </p>
            <p class="muted">Actualizado {{ hace }}. Se actualiza solo cada 30 segundos.</p>
            <p v-if="!estado.enLinea" class="dashboard__aviso">
              El sensor no ha reportado en los últimos minutos; el dato puede no estar al día.
            </p>
          </template>

          <p v-else-if="!error" class="muted">El sensor todavía no ha enviado datos.</p>

          <p v-if="error" class="dashboard__aviso" role="alert">
            {{ mensajeError(error) }} Reintentamos en 30 segundos.
          </p>
        </div>
      </div>

      <div class="dashboard__historial">
        <h3>Últimas 24 horas</h3>
        <HistorialGrafica :puntos="historial?.puntos ?? []" :horas="historial?.horas ?? 24" />

        <!-- Compact legend: also explains the colored bands of the chart -->
        <ul class="dashboard__leyenda" aria-label="Qué significa cada estado">
          <li v-for="item in leyenda" :key="item.etiqueta" :title="item.etiqueta" :style="{ '--color': item.color }">
            <span aria-hidden="true">{{ item.emoji }}</span>
            <span class="visually-hidden">{{ item.etiqueta }}:</span>
            {{ item.rango }}
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 16px;
}

@media (min-width: 720px) {
  .dashboard {
    padding: 20px;
  }
}

/* Thermometer beside the state even on phones, so the answer is visible without scrolling */
.dashboard__principal {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 12px;
  align-items: center;
}

@media (min-width: 720px) {
  .dashboard__principal {
    grid-template-columns: 200px 1fr;
    gap: 16px;
  }
}

.dashboard__termometro {
  height: 190px;
}

@media (min-width: 720px) {
  .dashboard__termometro {
    height: 260px;
  }
}

.dashboard__vivo {
  margin: 0;
  font-size: 0.9rem;
}

.dashboard__etiqueta {
  font-family: var(--font-title);
  font-size: clamp(1.9rem, 7vw, 3.4rem);
  line-height: 1.05;
  margin: 4px 0 6px;
}

.dashboard__temperatura {
  font-size: clamp(1.6rem, 6vw, 2rem);
  font-weight: 800;
  margin: 0 0 6px;
}

.dashboard__humedad {
  font-size: 1rem;
  font-weight: 400;
}

.dashboard__aviso {
  color: var(--extremo);
  font-weight: 600;
}

.dashboard__leyenda {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 0.85rem;
  color: var(--muted);
}

.dashboard__leyenda li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Small color swatch matching the chart band */
.dashboard__leyenda li::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--color);
}

.dashboard__historial {
  margin-top: 20px;
}

.dashboard__historial h3 {
  font-size: 1.5rem;
  margin-bottom: 8px;
}
</style>
