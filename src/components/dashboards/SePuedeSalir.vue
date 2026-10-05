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
  { emoji: '🧥', etiqueta: '¡Ya, suéter!', rango: 'menos de 20 °C', color: 'var(--frio)' },
  { emoji: '🍃', etiqueta: 'Increíble', rango: '20 a 30 °C', color: 'var(--ideal)' },
  { emoji: '😎', etiqueta: 'Se aguanta', rango: '30 a 35 °C', color: 'var(--calor)' },
  { emoji: '🔥', etiqueta: 'Mejor ni asomarse', rango: 'más de 35 °C', color: 'var(--extremo)' },
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
          <p class="dashboard__vivo">
            <span class="badge-live">En vivo</span>
            <span class="muted">Hermosillo, Sonora</span>
          </p>

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

      <ul class="dashboard__leyenda" aria-label="Qué significa cada estado">
        <li v-for="item in leyenda" :key="item.etiqueta" :style="{ '--color': item.color }">
          <span aria-hidden="true">{{ item.emoji }}</span>
          <strong>{{ item.etiqueta }}</strong>
          <span class="muted">{{ item.rango }}</span>
        </li>
      </ul>

      <div class="dashboard__historial">
        <h3>Últimas 24 horas</h3>
        <HistorialGrafica :puntos="historial?.puntos ?? []" :horas="historial?.horas ?? 24" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 20px;
}

.dashboard__principal {
  display: grid;
  gap: 16px;
  align-items: center;
}

@media (min-width: 720px) {
  .dashboard__principal {
    grid-template-columns: 220px 1fr;
  }
}

.dashboard__termometro {
  height: 280px;
}

.dashboard__vivo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dashboard__etiqueta {
  font-family: var(--font-title);
  font-size: clamp(2.4rem, 8vw, 3.4rem);
  line-height: 1.05;
  margin: 8px 0;
}

.dashboard__temperatura {
  font-size: 2rem;
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
  margin: 20px 0;
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.dashboard__leyenda li {
  display: grid;
  padding: 10px 12px;
  border-radius: var(--radius);
  border-left: 4px solid var(--color);
  background: var(--surface-2);
  font-size: 0.9rem;
}

.dashboard__historial h3 {
  font-size: 1.5rem;
}
</style>
