<script setup>
/**
 * "Análisis" tab of ¿Se puede salir?: records, calendar by day (morning / afternoon /
 * night), the typical day, the daily trend, time in each state and the battery.
 * Everything comes from one request (GET /api/se-puede-salir/analisis).
 */
import { computed } from 'vue'
import EstadoCarga from '../EstadoCarga.vue'
import EstadoError from '../EstadoError.vue'
import CalendarioTemperaturas from './CalendarioTemperaturas.vue'
import GraficaDiaTipico from './GraficaDiaTipico.vue'
import GraficaTendencia from './GraficaTendencia.vue'
import BarraEstados from './BarraEstados.vue'
import GraficaBateria from './GraficaBateria.vue'
import { useApi } from '../../composables/useApi'
import { getAnalisis } from '../../api/sePuedeSalir'
import { fechaCorta, grados, momento } from './escala'

const { data, error, loading, reload } = useApi((signal) => getAnalisis(90, signal))

const fmtNumero = new Intl.NumberFormat('es-MX')

const tarjetas = computed(() => {
  const r = data.value?.records
  if (!r) return []
  return [
    r.maxima && { titulo: 'Máxima', valor: grados(r.maxima.temperatura), detalle: momento(r.maxima.medidoEn), color: 'var(--extremo)' },
    r.minima && { titulo: 'Mínima', valor: grados(r.minima.temperatura), detalle: momento(r.minima.medidoEn), color: 'var(--frio)' },
    r.diaMasCaliente && { titulo: 'Día más caluroso', valor: grados(r.diaMasCaliente.promedio), detalle: `${fechaCorta(r.diaMasCaliente.fecha)} · promedio`, color: 'var(--calor)' },
    r.diaMasFresco && { titulo: 'Día más fresco', valor: grados(r.diaMasFresco.promedio), detalle: `${fechaCorta(r.diaMasFresco.fecha)} · promedio`, color: 'var(--ideal)' },
  ].filter(Boolean)
})
</script>

<template>
  <EstadoCarga v-if="loading && !data" texto="Analizando las lecturas…" />
  <EstadoError v-else-if="error" :error="error" titulo="No se pudo cargar el análisis" @reintentar="reload" />
  <p v-else-if="data && !data.totalLecturas" class="muted">Todavía no hay lecturas para analizar.</p>

  <div v-else-if="data" class="analisis">
    <section class="bloque" aria-labelledby="a-resumen">
      <h2 id="a-resumen" class="bloque__titulo">Análisis</h2>
      <p class="muted">
        {{ data.dias.length }} días de datos, del {{ fechaCorta(data.dias[0].fecha) }} al
        {{ fechaCorta(data.dias[data.dias.length - 1].fecha) }}: {{ fmtNumero.format(data.totalLecturas) }} lecturas,
        una cada 30 segundos. Hora de Hermosillo.
      </p>
      <ul class="records">
        <li v-for="t in tarjetas" :key="t.titulo" class="record card" :style="{ '--color': t.color }">
          <span class="record__titulo">{{ t.titulo }}</span>
          <strong class="record__valor">{{ t.valor }}</strong>
          <span class="muted record__detalle">{{ t.detalle }}</span>
        </li>
      </ul>
    </section>

    <section class="bloque" aria-labelledby="a-calendario">
      <h2 id="a-calendario" class="bloque__titulo">Calendario</h2>
      <p class="muted bloque__intro">
        Cada día muestra su temperatura <strong>máxima (↑)</strong> y, en pantallas grandes, su
        <strong>mínima (↓)</strong>. El color de fondo es el estado del <strong>promedio</strong> del día. Cada día
        va de las 6:00 a las 5:59, para que la noche quede completa. Toca un día para ver su mañana, tarde y noche.
      </p>
      <CalendarioTemperaturas :dias="data.dias" />
    </section>

    <section class="bloque" aria-labelledby="a-dia">
      <h2 id="a-dia" class="bloque__titulo">El día típico</h2>
      <GraficaDiaTipico :horas="data.diaTipico" />
    </section>

    <section class="bloque" aria-labelledby="a-tendencia">
      <h2 id="a-tendencia" class="bloque__titulo">Tendencia diaria</h2>
      <GraficaTendencia :dias="data.dias" />
    </section>

    <section class="bloque" aria-labelledby="a-estados">
      <h2 id="a-estados" class="bloque__titulo">Tiempo en cada estado</h2>
      <BarraEstados :estados="data.estados" />
    </section>

    <section v-if="data.bateria.length" class="bloque" aria-labelledby="a-bateria">
      <h2 id="a-bateria" class="bloque__titulo">Batería del sensor</h2>
      <GraficaBateria :puntos="data.bateria" />
    </section>
  </div>
</template>

<style scoped>
.bloque + .bloque {
  margin-top: 40px;
}

.bloque__titulo {
  font-size: clamp(1.9rem, 6vw, 2.4rem);
}

.bloque__intro {
  margin-bottom: 12px;
}

.records {
  list-style: none;
  padding: 0;
  margin: 14px 0 0;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 900px) {
  .records {
    grid-template-columns: repeat(4, 1fr);
  }
}

.record {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border-left: 4px solid var(--color);
}

.record__titulo {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
}

.record__valor {
  font-size: 1.5rem;
  line-height: 1.2;
}

.record__detalle {
  font-size: 0.8rem;
}
</style>
