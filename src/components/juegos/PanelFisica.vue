<script setup>
import { ref } from 'vue'

/**
 * Live tuning of the car physics. It edits the same object the game reads every tick,
 * so changes apply while driving. "Copiar" gives the JSON to paste into PARAMETROS_FISICA.
 */
const props = defineProps({
  params: { type: Object, required: true },
  iniciales: { type: Object, required: true },
})

const GRUPOS = [
  {
    nombre: 'Motor',
    controles: [
      { ruta: 'aceleracion', etiqueta: 'Aceleración', min: 5, max: 60, paso: 1, unidad: 'm/s²' },
      { ruta: 'velocidadMax', etiqueta: 'Velocidad máxima', min: 10, max: 60, paso: 1, unidad: 'm/s' },
      { ruta: 'frenado', etiqueta: 'Frenado', min: 10, max: 80, paso: 1, unidad: 'm/s²' },
      { ruta: 'reversaMax', etiqueta: 'Reversa máxima', min: 3, max: 20, paso: 1, unidad: 'm/s' },
    ],
  },
  {
    nombre: 'Volante',
    controles: [
      { ruta: 'giro', etiqueta: 'Giro', min: 1, max: 6, paso: 0.1, unidad: 'rad/s' },
      { ruta: 'respuestaGiro', etiqueta: 'Respuesta del volante', min: 2, max: 30, paso: 0.5 },
      { ruta: 'velocidadGiroPleno', etiqueta: 'Giro pleno desde', min: 2, max: 20, paso: 0.5, unidad: 'm/s' },
      { ruta: 'subviraje', etiqueta: 'Subviraje', min: 0, max: 0.8, paso: 0.05 },
    ],
  },
  {
    nombre: 'Freno de mano',
    controles: [
      { ruta: 'agarreMano', etiqueta: 'Agarre con freno de mano', min: 0.02, max: 1, paso: 0.01, unidad: '×' },
      { ruta: 'giroMano', etiqueta: 'Giro extra', min: 1, max: 2.5, paso: 0.05, unidad: '×' },
      { ruta: 'frenoMano', etiqueta: 'Frenado', min: 0, max: 20, paso: 0.5, unidad: 'm/s²' },
      { ruta: 'recuperacion', etiqueta: 'Salida del derrape', min: 0, max: 1, paso: 0.05 },
    ],
  },
  ...['asfalto', 'tierra'].map((suelo) => ({
    nombre: suelo === 'asfalto' ? 'Asfalto' : 'Tierra',
    controles: [
      { ruta: `superficies.${suelo}.agarre`, etiqueta: 'Agarre lateral', min: 0.5, max: 30, paso: 0.5, unidad: '1/s' },
      { ruta: `superficies.${suelo}.traccion`, etiqueta: 'Tracción', min: 0.1, max: 1.5, paso: 0.05, unidad: '×' },
      { ruta: `superficies.${suelo}.velocidadMax`, etiqueta: 'Velocidad máxima', min: 0.2, max: 1.2, paso: 0.05, unidad: '×' },
      { ruta: `superficies.${suelo}.rodamiento`, etiqueta: 'Rodamiento', min: 0, max: 20, paso: 0.5, unidad: 'm/s²' },
    ],
  })),
  {
    nombre: 'Choques',
    controles: [{ ruta: 'rebote', etiqueta: 'Rebote', min: 0, max: 1, paso: 0.05 }],
  },
]

function leer(objeto, ruta) {
  return ruta.split('.').reduce((o, k) => o[k], objeto)
}

function escribir(ruta, valor) {
  const claves = ruta.split('.')
  const ultima = claves.pop()
  claves.reduce((o, k) => o[k], props.params)[ultima] = Number(valor)
}

function restablecer(destino = props.params, origen = props.iniciales) {
  for (const [k, v] of Object.entries(origen)) {
    if (v && typeof v === 'object') restablecer(destino[k], v)
    else destino[k] = v
  }
}

const copiado = ref(false)
async function copiar() {
  await navigator.clipboard.writeText(JSON.stringify(props.params, null, 2))
  copiado.value = true
  setTimeout(() => (copiado.value = false), 1500)
}
</script>

<template>
  <aside class="panel card" aria-label="Ajustes de la física">
    <header class="panel__encabezado">
      <h2 class="panel__titulo">Física</h2>
      <div class="panel__acciones">
        <button type="button" class="btn btn--sm btn--ghost" @click="restablecer()">Restablecer</button>
        <button type="button" class="btn btn--sm" @click="copiar">{{ copiado ? 'Copiado' : 'Copiar JSON' }}</button>
      </div>
    </header>

    <details v-for="(grupo, i) in GRUPOS" :key="grupo.nombre" class="panel__grupo" :open="i < 3">
      <summary>{{ grupo.nombre }}</summary>
      <label v-for="c in grupo.controles" :key="c.ruta" class="panel__control">
        <span class="panel__etiqueta">
          {{ c.etiqueta }}
          <output>{{ leer(params, c.ruta) }}<small v-if="c.unidad"> {{ c.unidad }}</small></output>
        </span>
        <input
          type="range"
          :min="c.min"
          :max="c.max"
          :step="c.paso"
          :value="leer(params, c.ruta)"
          @input="escribir(c.ruta, $event.target.value)"
        />
      </label>
    </details>
  </aside>
</template>

<style scoped>
.panel {
  padding: 16px;
  display: grid;
  gap: 8px;
  align-content: start;
}

.panel__encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.panel__titulo {
  font-size: 1.6rem;
  margin: 0;
}

.panel__acciones {
  display: flex;
  gap: 6px;
}

.panel__grupo {
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.panel__grupo summary {
  cursor: pointer;
  font-weight: 600;
  padding: 2px 0 6px;
}

.panel__control {
  display: grid;
  gap: 2px;
  padding: 4px 0;
}

.panel__etiqueta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.88rem;
}

.panel__etiqueta output {
  font-variant-numeric: tabular-nums;
  color: var(--accent-ink);
}

.panel__control input {
  width: 100%;
  accent-color: var(--accent);
}
</style>
