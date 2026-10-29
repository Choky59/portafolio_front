<script setup>
import { ref } from 'vue'

/**
 * The game's canvas with its HUD and the "click to drive" overlay. The canvas takes keyboard
 * focus, so the arrows and space drive the car instead of scrolling the page.
 * The parent gets the <canvas> through the exposed `lienzo` and runs the game on it.
 */
defineProps({
  hud: { type: Object, required: true },
  // ?debug: how often and how far the own car had to be corrected (rubber-banding)
  debug: { type: Boolean, default: false },
})
const emit = defineEmits(['tecla'])

const lienzo = ref(null)
const enfocado = ref(false)

defineExpose({
  lienzo,
  enfocar: () => lienzo.value?.focus(),
})
</script>

<template>
  <div class="lienzo-juego">
    <canvas
      ref="lienzo"
      class="lienzo-juego__canvas"
      tabindex="0"
      aria-label="Juego: maneja con flechas o WASD, espacio para el freno de mano"
      @focus="enfocado = true"
      @blur="enfocado = false"
      @keydown="emit('tecla', $event)"
    ></canvas>

    <div class="lienzo-juego__hud" aria-hidden="true">
      <span class="lienzo-juego__velocidad">{{ hud.kmh }}<small> km/h</small></span>
      <span class="lienzo-juego__suelo" :class="{ 'lienzo-juego__suelo--tierra': hud.suelo === 'tierra' }">{{ hud.suelo }}</span>
      <span class="lienzo-juego__derrape"><span :style="{ width: `${hud.derrape * 100}%` }"></span></span>
      <span v-if="hud.ping != null" class="lienzo-juego__retraso">ping {{ hud.ping }} ms</span>
      <span v-if="debug && hud.correcciones !== undefined" class="lienzo-juego__retraso lienzo-juego__debug">
        {{ hud.correcciones }} corr/s · última {{ hud.ultimaCorreccion.toFixed(2) }} m
      </span>
    </div>

    <slot />

    <button v-if="!enfocado" type="button" class="lienzo-juego__pausa" @click="lienzo.focus()">
      Haz clic para manejar
    </button>
  </div>
</template>

<style scoped>
.lienzo-juego {
  position: relative;
  align-self: start;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow);
  background: #22170f;
}

.lienzo-juego:focus-within {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.lienzo-juego__canvas {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  outline: none;
}

.lienzo-juego__hud {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(34, 23, 15, 0.75);
  color: #f1e6cc;
  pointer-events: none;
}

.lienzo-juego__velocidad {
  font-family: var(--font-title);
  font-size: 1.6rem;
  min-width: 4.5ch;
  font-variant-numeric: tabular-nums;
}

.lienzo-juego__suelo,
.lienzo-juego__retraso {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.lienzo-juego__retraso {
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

.lienzo-juego__suelo--tierra {
  color: #f4b33a;
}

.lienzo-juego__derrape {
  width: 60px;
  height: 6px;
  border-radius: 3px;
  background: rgba(241, 230, 204, 0.2);
  overflow: hidden;
}

.lienzo-juego__derrape span {
  display: block;
  height: 100%;
  background: #e4572e;
}

.lienzo-juego__pausa {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(34, 23, 15, 0.45);
  color: #f1e6cc;
  font: 400 2rem var(--font-title);
  cursor: pointer;
}
</style>
