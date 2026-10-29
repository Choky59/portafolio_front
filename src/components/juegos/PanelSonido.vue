<script setup>
import { ref, watch } from 'vue'
import { AJUSTES_SONIDO } from '../../juego/sonido.js'

/**
 * Sound settings: a volume per channel plus the engine's character. Changes apply live and
 * are remembered in this browser; releasing a slider plays a sample of that channel.
 */
const props = defineProps({
  /** The game's sound (crearSonido), null until the game is running */
  sonido: { type: Object, default: null },
})
const emit = defineEmits(['listo'])

const VOLUMENES = [
  { clave: 'general', etiqueta: 'General' },
  { clave: 'motor', etiqueta: 'Tu motor' },
  { clave: 'otros', etiqueta: 'Motores de los demás' },
  { clave: 'llantas', etiqueta: 'Llantas (derrape y tierra)' },
  { clave: 'golpes', etiqueta: 'Golpes y explosiones' },
  { clave: 'items', etiqueta: 'Items' },
  { clave: 'avisos', etiqueta: 'Avisos (cuenta, puntos, fanfarria)' },
  { clave: 'ambiente', etiqueta: 'Ambiente (viento)' },
]

const MOTOR = [
  { clave: 'tono', etiqueta: 'Tono', min: 0.6, max: 1.6, paso: 0.05, mostrar: (v) => `${v.toFixed(2)}×` },
  { clave: 'grunido', etiqueta: 'Gruñido', min: 0, max: 40, paso: 1, mostrar: (v) => String(v) },
]

const ajustes = ref({ ...AJUSTES_SONIDO })
const silencio = ref(false)

watch(
  () => props.sonido,
  (s) => {
    if (!s) return
    ajustes.value = s.ajustes
    silencio.value = s.silencio
  },
  { immediate: true },
)

function cambiar(clave, valor) {
  ajustes.value[clave] = Number(valor)
  props.sonido?.ponerAjuste(clave, valor)
}

function probar(clave) {
  props.sonido?.activar()
  props.sonido?.probar(clave)
  emit('listo')
}

function alternarSilencio() {
  if (props.sonido) silencio.value = props.sonido.alternarSilencio()
  emit('listo')
}

function restablecer() {
  props.sonido?.restablecer()
  ajustes.value = { ...AJUSTES_SONIDO }
  emit('listo')
}
</script>

<template>
  <section class="sonido" aria-label="Ajustes de sonido">
    <div class="sonido__acciones">
      <button type="button" class="btn btn--sm btn--ghost" :aria-pressed="silencio" @click="alternarSilencio">
        {{ silencio ? 'Sin sonido' : 'Con sonido' }}
      </button>
      <button type="button" class="btn btn--sm btn--ghost" @click="restablecer">Restablecer</button>
    </div>

    <details class="sonido__grupo" open>
      <summary>Volumen</summary>
      <label v-for="c in VOLUMENES" :key="c.clave" class="sonido__control">
        <span class="sonido__etiqueta">
          {{ c.etiqueta }}
          <output>{{ Math.round(ajustes[c.clave] * 100) }}%</output>
        </span>
        <input
          type="range"
          min="0"
          :max="c.clave === 'general' ? 1 : 1.5"
          step="0.05"
          :value="ajustes[c.clave]"
          :disabled="!sonido"
          @input="cambiar(c.clave, $event.target.value)"
          @change="probar(c.clave)"
        />
      </label>
    </details>

    <details class="sonido__grupo">
      <summary>Carácter del motor</summary>
      <label v-for="c in MOTOR" :key="c.clave" class="sonido__control">
        <span class="sonido__etiqueta">
          {{ c.etiqueta }}
          <output>{{ c.mostrar(ajustes[c.clave]) }}</output>
        </span>
        <input
          type="range"
          :min="c.min"
          :max="c.max"
          :step="c.paso"
          :value="ajustes[c.clave]"
          :disabled="!sonido"
          @input="cambiar(c.clave, $event.target.value)"
          @change="emit('listo')"
        />
      </label>
      <p class="sonido__nota muted">Acelera mientras lo mueves para oír el cambio.</p>
    </details>
  </section>
</template>

<style scoped>
.sonido {
  display: grid;
  gap: 8px;
}

.sonido__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sonido__grupo {
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.sonido__grupo summary {
  cursor: pointer;
  font-weight: 600;
  padding: 2px 0 6px;
}

.sonido__control {
  display: grid;
  gap: 2px;
  padding: 4px 0;
}

.sonido__etiqueta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.85rem;
}

.sonido__etiqueta output {
  font-variant-numeric: tabular-nums;
  color: var(--accent-ink);
}

.sonido__control input {
  width: 100%;
  accent-color: var(--accent);
}

.sonido__nota {
  margin: 4px 0 0;
  font-size: 0.8rem;
}
</style>
