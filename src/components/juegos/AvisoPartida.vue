<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/**
 * Big messages over the game: 3 · 2 · 1 · ¡Ya!, "you blew up" and who scored the round.
 * The countdown runs locally from the `restanteMs` the server sent with the phase.
 */
const props = defineProps({
  partida: { type: Object, required: true },
  vivo: { type: Boolean, default: true },
  /** Eliminated in a room where spectators throw meteors: the message gets out of the way soon */
  meteoritos: { type: Boolean, default: false },
  /** id → { nombre, color } */
  jugadores: { type: Object, required: true },
})

const emit = defineEmits(['cambio'])

const ahora = ref(performance.now())
const recibido = ref(performance.now())
/** "¡Ya!" shows only right after the countdown, not on every update during the race */
const yaHasta = ref(0)
watch(
  () => props.partida,
  (nueva, antes) => {
    recibido.value = performance.now()
    if (nueva.fase === 'carrera' && antes?.fase === 'cuenta') yaHasta.value = performance.now() + 800
  },
  { immediate: true },
)
/** When I blew up (to clear the "¡Kaboom!" so a spectator can see where to aim) */
const muerto = ref(0)
watch(
  () => props.vivo,
  (vivo) => {
    if (!vivo) muerto.value = performance.now()
  },
)
const reloj = setInterval(() => (ahora.value = performance.now()), 100)
onBeforeUnmount(() => clearInterval(reloj))

// The 100 ms clock can lag behind the moment the phase arrived: never count negative time (a "4")
const restante = computed(() => Math.max(0, props.partida.restanteMs - Math.max(0, ahora.value - recibido.value)))

const aviso = computed(() => {
  const { fase, ganadorRonda } = props.partida
  if (fase === 'cuenta') return { grande: String(Math.max(1, Math.ceil(restante.value / 1000))), chico: `Ronda ${props.partida.ronda}` }
  if (fase === 'carrera' && ahora.value < yaHasta.value) return { grande: '¡Ya!' }
  if (fase === 'carrera' && !props.vivo && props.meteoritos) {
    return ahora.value < muerto.value + 2500 ? { grande: '¡Kaboom!', chico: 'Ahora te toca tirar meteoritos' } : null
  }
  if (fase === 'carrera' && !props.vivo) return { grande: '¡Kaboom!', chico: 'Te quedaste fuera. Espera la siguiente ronda.' }
  if (fase === 'ronda-fin') {
    const g = props.jugadores[ganadorRonda]
    return g ? { grande: `Punto para ${g.nombre}`, color: g.color } : { grande: 'Nadie suma', chico: 'Cayeron al mismo tiempo' }
  }
  return null
})

// The parent plays the countdown beeps from here
watch(
  () => aviso.value?.grande,
  (grande) => grande && emit('cambio', grande),
)
</script>

<template>
  <Transition name="aviso">
    <div v-if="aviso" :key="aviso.grande" class="aviso" role="status" aria-live="polite">
      <p class="aviso__grande" :style="aviso.color ? { color: aviso.color } : null">{{ aviso.grande }}</p>
      <p v-if="aviso.chico" class="aviso__chico">{{ aviso.chico }}</p>
    </div>
  </Transition>
</template>

<style scoped>
.aviso {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
  padding: 16px;
}

.aviso__grande {
  margin: 0;
  font: 400 clamp(2.6rem, 9vw, 5.5rem) / 1 var(--font-title);
  color: #f1e6cc;
  -webkit-text-stroke: 2px #22170f;
  text-shadow: 0 4px 0 #22170f;
}

.aviso__chico {
  margin: 8px auto 0;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(34, 23, 15, 0.75);
  color: #f1e6cc;
  font-weight: 600;
}

.aviso-enter-active {
  transition: transform 0.25s cubic-bezier(0.2, 1.6, 0.4, 1), opacity 0.2s;
}

.aviso-leave-active {
  transition: opacity 0.15s;
}

.aviso-enter-from {
  transform: scale(0.6);
  opacity: 0;
}

.aviso-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .aviso-enter-active {
    transition: opacity 0.2s;
  }

  .aviso-enter-from {
    transform: none;
  }
}
</style>
