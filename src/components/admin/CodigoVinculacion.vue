<script setup>
/**
 * Shows a pairing code with its countdown. The code is only returned once by the
 * API, so it lives here until the admin closes the panel.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  nombre: { type: String, required: true },
  codigo: { type: String, required: true },
  expiraEn: { type: String, required: true },
})

defineEmits(['cerrar'])

const ahora = ref(Date.now())
const copiado = ref(false)
let reloj = null

onMounted(() => {
  reloj = setInterval(() => (ahora.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(reloj))

const restante = computed(() => Math.max(0, new Date(props.expiraEn).getTime() - ahora.value))
const vencido = computed(() => restante.value === 0)
const relojTexto = computed(() => {
  const s = Math.ceil(restante.value / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})

async function copiar() {
  try {
    await navigator.clipboard.writeText(props.codigo)
    copiado.value = true
    setTimeout(() => (copiado.value = false), 2000)
  } catch {
    // clipboard not available: the code is on screen anyway
  }
}
</script>

<template>
  <div class="codigo card" role="region" :aria-label="`Código de vinculación de ${nombre}`">
    <p class="codigo__titulo">Código para <strong>{{ nombre }}</strong></p>

    <p class="codigo__valor" :class="{ 'codigo__valor--vencido': vencido }">{{ codigo }}</p>

    <p v-if="!vencido" class="muted">
      Vence en <strong>{{ relojTexto }}</strong> y sirve una sola vez. Escríbelo en el ESP32 (por Serial o el portal WiFi):
      el sensor lo canjea en <code>POST /api/devices/claim</code> y guarda su llave en NVS.
    </p>
    <p v-else class="codigo__vencido">Este código ya venció. Genera uno nuevo desde la lista.</p>

    <div class="codigo__acciones">
      <button v-if="!vencido" type="button" class="btn btn--sm" @click="copiar">
        {{ copiado ? '¡Copiado!' : 'Copiar código' }}
      </button>
      <button type="button" class="btn btn--ghost btn--sm" @click="$emit('cerrar')">Cerrar</button>
    </div>
  </div>
</template>

<style scoped>
.codigo {
  padding: 20px;
  border: 2px solid var(--accent);
}

.codigo__titulo {
  margin: 0;
}

.codigo__valor {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: clamp(2rem, 10vw, 3rem);
  font-weight: 800;
  letter-spacing: 0.12em;
  margin: 8px 0;
  color: var(--accent-ink);
}

.codigo__valor--vencido {
  text-decoration: line-through;
  opacity: 0.5;
}

.codigo__vencido {
  color: var(--extremo);
  font-weight: 600;
}

.codigo__acciones {
  display: flex;
  gap: 10px;
}
</style>
