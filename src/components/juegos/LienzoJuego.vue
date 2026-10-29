<script setup>
import { ref } from 'vue'
import { iconoItem } from '../../juego/render/iconos.js'

/**
 * The game's canvas with its HUD and the "click to drive" overlay. The canvas takes keyboard
 * focus, so the arrows and space drive the car instead of scrolling the page.
 * The parent gets the <canvas> through the exposed `lienzo` and runs the game on it.
 */
defineProps({
  hud: { type: Object, required: true },
  // ?debug: how often and how far the own car had to be corrected (rubber-banding)
  debug: { type: Boolean, default: false },
  /** Modo local: this is the shared screen (no car of its own): no HUD, no "click to drive" */
  pantalla: { type: Boolean, default: false },
  /**
   * Playing on the phone: the game takes the whole screen (even where the browser can't do real
   * full screen, like iPhone), the HUD goes up top (the controls take the bottom corners)
   */
  celular: { type: Boolean, default: false },
})
const emit = defineEmits(['tecla'])

const lienzo = ref(null)
const contenedor = ref(null)
const enfocado = ref(false)

defineExpose({
  lienzo,
  enfocar: () => lienzo.value?.focus(),
  /** The game (canvas and overlays) on the whole screen; Esc gets out */
  pantallaCompleta: () => contenedor.value?.requestFullscreen?.().catch(() => {}),
})
</script>

<template>
  <!-- The frame is what goes full screen; inside, the game keeps 16:9 and every overlay stays on it -->
  <div ref="contenedor" class="lienzo-juego-marco" :class="{ 'lienzo-juego-marco--celular': celular }">
  <div class="lienzo-juego">
    <canvas
      ref="lienzo"
      class="lienzo-juego__canvas"
      tabindex="0"
      aria-label="Juego: maneja con flechas o WASD, Shift o E para usar el item"
      @focus="enfocado = true"
      @blur="enfocado = false"
      @keydown="emit('tecla', $event)"
    ></canvas>

    <div v-if="!pantalla" class="lienzo-juego__hud" aria-hidden="true">
      <span class="lienzo-juego__velocidad">{{ hud.kmh }}<small> km/h</small></span>
      <span class="lienzo-juego__suelo" :class="{ 'lienzo-juego__suelo--tierra': hud.suelo === 'tierra' }">{{ hud.suelo }}</span>
      <span class="lienzo-juego__derrape"><span :style="{ width: `${hud.derrape * 100}%` }"></span></span>
      <span v-if="hud.ping != null" class="lienzo-juego__retraso">ping {{ hud.ping }} ms</span>
      <span v-if="debug && hud.correcciones !== undefined" class="lienzo-juego__retraso lienzo-juego__debug">
        {{ hud.correcciones }} corr/s · última {{ hud.ultimaCorreccion.toFixed(2) }} m
      </span>
    </div>

    <!-- Out of the shared camera's picture: a last chance to catch up before blowing up -->
    <div v-if="hud.fuera" class="lienzo-juego__fuera" aria-live="assertive">¡Alcánzalos!</div>

    <!-- Spectator: aim with the mouse and click to throw a meteor -->
    <div v-if="hud.meteorito" class="lienzo-juego__meteorito" aria-live="polite">
      <template v-if="hud.meteorito.aviso">{{ hud.meteorito.aviso }}</template>
      <template v-else-if="hud.meteorito.recarga > 0">Otro meteorito en {{ Math.ceil(hud.meteorito.recarga) }} s</template>
      <template v-else><b>{{ celular ? 'Toca la pista' : 'Clic en la pista' }}</b> para tirar un meteorito</template>
    </div>

    <!-- The item you're carrying: use it with Shift or E -->
    <div v-if="hud.item !== undefined" class="lienzo-juego__item" :class="{ 'lienzo-juego__item--vacio': !hud.item }">
      <template v-if="hud.item">
        <img :src="iconoItem(hud.item)" alt="" width="48" height="48" />
        <span>
          <strong>{{ hud.item.nombre }}</strong>
          <small><kbd>Shift</kbd> o <kbd>E</kbd></small>
        </span>
      </template>
      <span v-else class="lienzo-juego__sin-item">Agarra una caja <b>?</b></span>
    </div>

    <button v-if="!enfocado && !pantalla && !celular" type="button" class="lienzo-juego__pausa" @click="lienzo.focus()">
      Haz clic para manejar
    </button>

    <!-- Overlays from the parent (messages, results) go above "click to drive": pressing one of
         their buttons blurs the canvas, and the click must still land on the button -->
    <slot />
  </div>
  </div>
</template>

<style scoped>
.lienzo-juego-marco {
  align-self: start;
}

.lienzo-juego {
  position: relative;
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

/* Full screen: the game as big as fits keeping 16:9 (everybody sees the same picture), dark bands
   around; the HUD and overlays stay on the picture, not on the bands */
.lienzo-juego-marco:fullscreen {
  display: grid;
  place-items: center;
  background: #22170f;
}

/* Playing on the phone: the same, without needing real full screen */
.lienzo-juego-marco--celular {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: #22170f;
  touch-action: none;
  overscroll-behavior: none;
}

.lienzo-juego-marco--celular .lienzo-juego,
.lienzo-juego-marco:fullscreen .lienzo-juego {
  width: min(100vw, calc(100vh * 16 / 9));
  border-radius: 0;
  box-shadow: none;
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

.lienzo-juego__item {
  position: absolute;
  right: 12px;
  top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 24px);
  padding: 6px 12px 6px 6px;
  border-radius: 16px;
  background: rgba(34, 23, 15, 0.75);
  color: #f1e6cc;
  pointer-events: none;
}

.lienzo-juego__item img {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #f1e6cc;
}

.lienzo-juego__item strong {
  display: block;
  font: 400 1.3rem / 1.1 var(--font-title);
}

.lienzo-juego__item small {
  font-size: 0.75rem;
  opacity: 0.8;
}

.lienzo-juego__item kbd {
  padding: 0 4px;
  border: 1px solid rgba(241, 230, 204, 0.4);
  border-radius: 4px;
  font: 600 0.7rem var(--font-body);
}

.lienzo-juego__item--vacio {
  padding: 6px 12px;
  opacity: 0.8;
}

.lienzo-juego__sin-item {
  font-size: 0.8rem;
}

.lienzo-juego__sin-item b {
  color: #f4b33a;
}

.lienzo-juego__fuera {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: end center;
  padding-bottom: 64px;
  pointer-events: none;
  box-shadow: inset 0 0 0 6px #e4572e, inset 0 0 60px rgba(228, 87, 46, 0.55);
  color: #f1e6cc;
  font: 400 clamp(1.8rem, 5vw, 2.8rem) var(--font-title);
  -webkit-text-stroke: 1.5px #22170f;
  animation: lienzo-juego-alerta 0.5s ease-in-out infinite alternate;
}

@keyframes lienzo-juego-alerta {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lienzo-juego__fuera {
    animation: none;
  }
}

/* On the phone the controls take the bottom corners: just the speed up top (left, next to the ✕)
   and the item on the right, over the Item button */
.lienzo-juego-marco--celular .lienzo-juego__hud {
  top: 10px;
  bottom: auto;
  left: 56px;
  padding: 2px 12px;
}

.lienzo-juego-marco--celular .lienzo-juego__velocidad {
  font-size: 1.2rem;
}

.lienzo-juego-marco--celular .lienzo-juego__hud > :not(.lienzo-juego__velocidad) {
  display: none;
}

.lienzo-juego-marco--celular .lienzo-juego__item {
  top: 8px;
  right: 10px;
  padding: 4px 10px 4px 4px;
}

.lienzo-juego-marco--celular .lienzo-juego__item img {
  width: 36px;
  height: 36px;
}

.lienzo-juego-marco--celular .lienzo-juego__item small {
  display: none;
}

.lienzo-juego-marco--celular .lienzo-juego__meteorito {
  top: 56px;
}

.lienzo-juego__meteorito {
  position: absolute;
  left: 50%;
  top: 12px;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(34, 23, 15, 0.8);
  color: #f1e6cc;
  font-size: 0.9rem;
  text-align: center;
  pointer-events: none;
}

.lienzo-juego__meteorito b {
  color: #e4572e;
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
