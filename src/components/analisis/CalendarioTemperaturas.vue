<script setup>
/**
 * Month calendar of the analysis: each day colored by the state of its average, with
 * its max (and min on wider screens). Tapping a day shows its morning, afternoon and
 * night below, plus that day's chart. A "day" runs 06:00 → 05:59, so each night stays complete in one day.
 */
import { computed, ref } from 'vue'
import GraficaDia from './GraficaDia.vue'
import { colorEstado, fechaLarga, grados, nombreMes } from './escala'

const props = defineProps({
  dias: { type: Array, required: true }, // [{ fecha, min, max, promedio, estado, lecturas, franjas }]
})

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const FRANJAS = [
  { clave: 'manana', nombre: 'Mañana', horario: '6:00 a 12:00', emoji: '🌅' },
  { clave: 'tarde', nombre: 'Tarde', horario: '12:00 a 19:00', emoji: '☀️' },
  { clave: 'noche', nombre: 'Noche', horario: '19:00 a 6:00', emoji: '🌙' },
]

const porFecha = computed(() => new Map(props.dias.map((d) => [d.fecha, d])))

/** One grid per month between the first and last day with data (weeks start on Monday) */
const meses = computed(() => {
  if (!props.dias.length) return []
  const [y0, m0] = props.dias[0].fecha.split('-').map(Number)
  const [y1, m1] = props.dias[props.dias.length - 1].fecha.split('-').map(Number)
  const lista = []
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? ((m = 1), y++) : m++) {
    const clave = `${y}-${String(m).padStart(2, '0')}`
    const diasEnMes = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const vacios = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 // Monday = 0
    const celdas = [
      ...Array.from({ length: vacios }, (_, i) => ({ vacio: true, key: `v${i}` })),
      ...Array.from({ length: diasEnMes }, (_, i) => {
        const fecha = `${clave}-${String(i + 1).padStart(2, '0')}`
        return { key: fecha, fecha, numero: i + 1, dia: porFecha.value.get(fecha) ?? null }
      }),
    ]
    lista.push({ clave, nombre: nombreMes(`${clave}-01`), celdas })
  }
  return lista
})

const seleccionada = ref(props.dias.length ? props.dias[props.dias.length - 1].fecha : null)
const dia = computed(() => (seleccionada.value ? porFecha.value.get(seleccionada.value) : null))

const etiqueta = (d) =>
  `${fechaLarga(d.fecha)}: máxima ${grados(d.max)}, mínima ${grados(d.min)}, promedio ${grados(d.promedio)}`
</script>

<template>
  <div class="cal">
    <section v-for="mes in meses" :key="mes.clave" class="cal__mes" :aria-label="mes.nombre">
      <h3 class="cal__nombre">{{ mes.nombre }}</h3>
      <div class="cal__grid" role="grid">
        <span v-for="(d, i) in SEMANA" :key="i" class="cal__semana" aria-hidden="true">{{ d }}</span>

        <template v-for="c in mes.celdas" :key="c.key">
          <span v-if="c.vacio" class="cal__celda cal__celda--vacia" aria-hidden="true" />
          <button
            v-else-if="c.dia"
            type="button"
            class="cal__celda cal__celda--dato"
            :class="{ 'cal__celda--activa': seleccionada === c.fecha }"
            :style="{ '--estado': colorEstado(c.dia.estado) }"
            :aria-label="etiqueta(c.dia)"
            :aria-pressed="seleccionada === c.fecha"
            @click="seleccionada = c.fecha"
          >
            <span class="cal__numero">{{ c.numero }}</span>
            <span class="cal__max"><span class="cal__flecha" aria-hidden="true">↑</span>{{ Math.round(c.dia.max) }}°</span>
            <span class="cal__min"><span class="cal__flecha" aria-hidden="true">↓</span>{{ Math.round(c.dia.min) }}°</span>
          </button>
          <span v-else class="cal__celda cal__celda--sin" :aria-label="`${c.numero}: sin datos`">
            <span class="cal__numero">{{ c.numero }}</span>
          </span>
        </template>
      </div>
    </section>

    <!-- Detail of the selected day -->
    <section v-if="dia" class="cal__detalle card" aria-live="polite">
      <header class="cal__detalle-cabecera">
        <h3 class="cal__detalle-fecha">{{ fechaLarga(dia.fecha) }}</h3>
        <p class="muted">
          Todo el día: máx <strong>{{ grados(dia.max) }}</strong> · mín <strong>{{ grados(dia.min) }}</strong> ·
          promedio <strong>{{ grados(dia.promedio) }}</strong>
        </p>
      </header>

      <ul class="cal__franjas">
        <li v-for="f in FRANJAS" :key="f.clave" class="cal__franja">
          <p class="cal__franja-nombre">
            <span aria-hidden="true">{{ f.emoji }}</span> {{ f.nombre }}
            <span class="muted cal__franja-horario">{{ f.horario }}</span>
          </p>
          <dl v-if="dia.franjas[f.clave]" class="cal__valores">
            <div><dt>Máx</dt><dd>{{ grados(dia.franjas[f.clave].max) }}</dd></div>
            <div><dt>Mín</dt><dd>{{ grados(dia.franjas[f.clave].min) }}</dd></div>
            <div><dt>Prom</dt><dd>{{ grados(dia.franjas[f.clave].promedio) }}</dd></div>
          </dl>
          <p v-else class="muted cal__sin-datos">Sin datos</p>
        </li>
      </ul>

      <GraficaDia :fecha="dia.fecha" class="cal__grafica" />
    </section>
  </div>
</template>

<style scoped>
.cal__mes + .cal__mes {
  margin-top: 20px;
}

.cal__nombre {
  font-size: 1.4rem;
  margin-bottom: 8px;
}

.cal__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.cal__semana {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted);
  padding-bottom: 2px;
}

.cal__celda {
  display: grid;
  align-content: start;
  min-height: 52px;
  padding: 4px;
  border-radius: 8px;
  font: inherit;
  text-align: left;
  border: 1px solid transparent;
}

.cal__celda--vacia {
  visibility: hidden;
}

.cal__celda--sin {
  background: var(--surface);
  color: var(--muted);
  opacity: 0.6;
}

.cal__celda--dato {
  cursor: pointer;
  color: var(--text);
  background: color-mix(in srgb, var(--estado) 32%, var(--surface));
  border-color: color-mix(in srgb, var(--estado) 55%, transparent);
}

.cal__celda--dato:hover {
  border-color: var(--estado);
}

.cal__celda--activa {
  outline: 3px solid var(--accent);
  outline-offset: 1px;
}

.cal__flecha {
  font-size: 0.8em;
  font-weight: 700;
  margin-right: 1px;
  opacity: 0.75;
}

.cal__numero {
  font-size: 0.75rem;
  color: var(--muted);
}

.cal__max {
  font-weight: 800;
  font-size: 0.95rem;
  line-height: 1.2;
}

/* Phones: only the max fits */
.cal__min {
  display: none;
  font-size: 0.75rem;
  color: var(--muted);
}

@media (min-width: 640px) {
  .cal__celda {
    min-height: 68px;
    padding: 6px 8px;
  }

  .cal__min {
    display: block;
  }

  .cal__max {
    font-size: 1.05rem;
  }
}

.cal__detalle {
  margin-top: 18px;
  padding: 16px;
}

/* Only the first letter: "Miércoles, 14 de octubre", not "14 De Octubre" */
.cal__nombre::first-letter,
.cal__detalle-fecha::first-letter {
  text-transform: uppercase;
}

.cal__detalle-fecha {
  font-size: 1.6rem;
  margin-bottom: 2px;
}

.cal__detalle-cabecera p {
  margin: 0 0 12px;
  font-size: 0.95rem;
}

.cal__franjas {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

@media (min-width: 720px) {
  .cal__franjas {
    grid-template-columns: repeat(3, 1fr);
  }
}

.cal__franja {
  padding: 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
}

.cal__franja-nombre {
  margin: 0 0 8px;
  font-weight: 700;
}

.cal__franja-horario {
  font-weight: 400;
  font-size: 0.8rem;
}

.cal__valores {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 0;
}

.cal__valores dt {
  font-size: 0.75rem;
  color: var(--muted);
}

.cal__valores dd {
  margin: 0;
  font-weight: 700;
}

.cal__sin-datos {
  margin: 0;
}

.cal__grafica {
  margin-top: 18px;
}
</style>
