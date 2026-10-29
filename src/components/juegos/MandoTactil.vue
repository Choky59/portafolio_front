<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { crearInclinacion } from '../../juego/entrada/tactil.js'

/**
 * The on-screen controller: a joystick to steer on the left, and on the right Item on top of
 * Frenar (where the thumb rests). The car goes on its own (see entrada/tactil.js). It writes into
 * `mando` (crearMando()); whoever owns it reads it every tick.
 *
 * Used by the phone as a remote (ControlRemoto.vue, modo local) and over the game when it's
 * played on the phone (`superpuesto`: no background, and only the controls take touches, so the
 * rest of the picture stays free). The slot goes in the middle (the remote shows the item there).
 *
 * Steering is by tilting the phone like a steering wheel (crearInclinacion) or with the joystick;
 * a small button switches, and the choice is remembered. Tilting, a wheel takes the joystick's
 * place: it turns with the phone, and tapping it makes the current position "straight".
 */
const props = defineProps({
  mando: { type: Object, required: true },
  superpuesto: { type: Boolean, default: false },
})

const ZONA_MUERTA = 0.12
const GUARDADO = 'carreras:volante'

/* Only what's drawn lives in refs; the state the game reads is in the mando */
const pad = ref(null)
const perilla = ref({ x: 0, y: 0 })
const frenando = ref(false)
const itemApretado = ref(false)
let dedoPad = null

/** Joystick: only left and right matter (steering); the knob follows the finger inside the pad */
function moverPad(e) {
  const caja = pad.value.getBoundingClientRect()
  const radio = caja.width / 2
  let dx = (e.clientX - (caja.left + radio)) / radio
  let dy = (e.clientY - (caja.top + radio)) / radio
  const largo = Math.hypot(dx, dy)
  if (largo > 1) {
    dx /= largo
    dy /= largo
  }
  perilla.value = { x: dx, y: dy }
  const x = Math.abs(dx) < ZONA_MUERTA ? 0 : Math.sign(dx) * ((Math.abs(dx) - ZONA_MUERTA) / (1 - ZONA_MUERTA))
  props.mando.estado.giro = Math.max(-1, Math.min(1, x))
}

/** Keeps getting the finger's moves even if it slides off the element (some browsers refuse: no harm) */
function capturar(elemento, e) {
  try {
    elemento.setPointerCapture(e.pointerId)
  } catch {
    // Without capture it still works while the finger stays on it
  }
}

function tocarPad(e) {
  dedoPad = e.pointerId
  capturar(pad.value, e)
  moverPad(e)
}

function soltarPad(e) {
  if (e.pointerId !== dedoPad) return
  dedoPad = null
  perilla.value = { x: 0, y: 0 }
  props.mando.estado.giro = 0
}

/** A button: held while the finger is on it */
function boton(cual) {
  return {
    onPointerdown(e) {
      capturar(e.currentTarget, e)
      if (cual === 'freno') {
        frenando.value = true
        props.mando.estado.freno = true
      }
      if (cual === 'item') {
        itemApretado.value = true
        props.mando.estado.itemApretado = true
        props.mando.estado.itemPendiente = true
      }
      navigator.vibrate?.(12)
    },
    onPointerup: () => soltar(cual),
    onPointercancel: () => soltar(cual),
  }
}

/* ------------------------------ Tilt steering ------------------------------ */

const inclinacion = crearInclinacion(props.mando)
/** 'inclinar' (default where there are motion sensors) or 'joystick' */
const modo = ref(leerModo())
/** Tilting is on and readings arrive (on iPhone it needs a tap first, for the permission) */
const inclinando = ref(false)
const aviso = ref('')
/** The wheel drawn: the steering, -1 … 1 */
const volante = ref(0)
let cuadro = 0

function leerModo() {
  try {
    const guardado = localStorage.getItem(GUARDADO)
    if (guardado === 'joystick' || guardado === 'inclinar') return guardado
  } catch {
    // Private mode
  }
  return inclinacion.disponible ? 'inclinar' : 'joystick'
}

function dibujarVolante() {
  volante.value = props.mando.estado.giro
  cuadro = requestAnimationFrame(dibujarVolante)
}

/** Turns tilting on; if no readings come (a computer, a phone without sensors), back to the joystick */
async function activarInclinacion() {
  aviso.value = ''
  if (!(await inclinacion.activar())) {
    aviso.value = 'Toca el volante para activar la inclinación'
    return
  }
  inclinando.value = true
  cancelAnimationFrame(cuadro)
  dibujarVolante()
  setTimeout(() => {
    if (modo.value !== 'inclinar' || inclinacion.recibiendo) return
    cambiarModo('joystick')
    aviso.value = 'Este dispositivo no tiene sensor de movimiento'
  }, 1500)
}

function tocarVolante() {
  if (inclinando.value) inclinacion.centrar()
  else activarInclinacion()
  navigator.vibrate?.(12)
}

function cambiarModo(nuevo) {
  modo.value = nuevo
  try {
    localStorage.setItem(GUARDADO, nuevo)
  } catch {
    // Private mode
  }
  props.mando.estado.giro = 0
  if (nuevo === 'inclinar') {
    aviso.value = ''
    activarInclinacion()
  } else {
    inclinacion.detener()
    inclinando.value = false
    cancelAnimationFrame(cuadro)
  }
}

onMounted(() => {
  if (modo.value === 'inclinar') activarInclinacion()
})

onBeforeUnmount(() => {
  inclinacion.detener()
  cancelAnimationFrame(cuadro)
})

function soltar(cual) {
  if (cual === 'freno') {
    frenando.value = false
    props.mando.estado.freno = false
  }
  if (cual === 'item') {
    itemApretado.value = false
    props.mando.estado.itemApretado = false
  }
}
</script>

<template>
  <div class="mando" :class="{ 'mando--superpuesto': superpuesto }">
    <div class="mando__volante-zona">
      <button
        type="button"
        class="mando__cambiar"
        @click="cambiarModo(modo === 'inclinar' ? 'joystick' : 'inclinar')"
      >
        {{ modo === 'inclinar' ? 'Usar joystick' : 'Inclinar el celular' }}
      </button>
      <p v-if="aviso" class="mando__aviso">{{ aviso }}</p>

    <button
      v-if="modo === 'inclinar'"
      type="button"
      class="mando__pad mando__volante"
      :class="{ 'mando__volante--apagado': !inclinando }"
      aria-label="Volante: inclina el celular; tócalo para centrarlo"
      @click="tocarVolante"
    >
      <svg viewBox="-50 -50 100 100" :style="{ transform: `rotate(${volante * 70}deg)` }" aria-hidden="true">
        <circle r="40" class="mando__aro" />
        <circle r="9" class="mando__eje" />
        <path d="M -38 4 L -9 2 M 38 4 L 9 2 M 0 9 L 0 38" class="mando__rayos" />
      </svg>
      <span class="mando__volante-texto">{{ inclinando ? 'Toca para centrar' : 'Toca para activar' }}</span>
    </button>
    <div
      v-else
      ref="pad"
      class="mando__pad"
      aria-label="Volante: desliza a la izquierda o a la derecha"
      @pointerdown="tocarPad"
      @pointermove="dedoPad !== null && moverPad($event)"
      @pointerup="soltarPad"
      @pointercancel="soltarPad"
    >
      <span class="mando__flecha mando__flecha--izq">◀</span>
      <span class="mando__flecha mando__flecha--der">▶</span>
      <span class="mando__perilla" :style="{ transform: `translate(${perilla.x * 60}%, ${perilla.y * 60}%)` }"></span>
    </div>
    </div>

    <div class="mando__centro"><slot /></div>

    <div class="mando__botones">
      <button type="button" class="mando__boton mando__boton--item" :class="{ activo: itemApretado }" v-bind="boton('item')">
        Item
      </button>
      <button type="button" class="mando__boton mando__boton--freno" :class="{ activo: frenando }" v-bind="boton('freno')">
        Frenar
      </button>
    </div>
  </div>
</template>

<style scoped>
.mando {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  grid-template-areas: 'pad centro botones';
  align-items: center;
  gap: 12px;
  padding: 12px 20px 20px;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.mando__volante-zona {
  grid-area: pad;
  justify-self: start;
  display: grid;
  justify-items: center;
  gap: 8px;
}

.mando__cambiar {
  border: 1px solid rgba(241, 230, 204, 0.4);
  border-radius: 999px;
  background: rgba(34, 23, 15, 0.6);
  color: #f1e6cc;
  font-size: 0.8rem;
  padding: 4px 12px;
}

.mando__aviso {
  margin: 0;
  max-width: 220px;
  font-size: 0.75rem;
  text-align: center;
  color: #f6c445;
}

.mando__volante {
  padding: 0;
  color: #f1e6cc;
  cursor: pointer;
}

.mando__volante svg {
  width: 78%;
  height: 78%;
  transition: transform 0.05s linear;
}

.mando__aro {
  fill: none;
  stroke: var(--color, #f1e6cc);
  stroke-width: 9;
}

.mando__eje {
  fill: var(--color, #f1e6cc);
}

.mando__rayos {
  stroke: var(--color, #f1e6cc);
  stroke-width: 7;
  stroke-linecap: round;
}

.mando__volante-texto {
  position: absolute;
  bottom: 9%;
  font-size: 0.7rem;
  opacity: 0.75;
}

.mando__volante--apagado svg {
  opacity: 0.4;
}

.mando__pad {
  position: relative;
  position: relative;
  width: min(42vw, 62vh, 260px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(241, 230, 204, 0.12), rgba(241, 230, 204, 0.04));
  border: 3px solid rgba(241, 230, 204, 0.25);
  display: grid;
  place-items: center;
  touch-action: none;
}

.mando__perilla {
  width: 42%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--color, #f1e6cc);
  border: 4px solid #f1e6cc;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.mando__flecha {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.35;
  font-size: 1.4rem;
  color: #f1e6cc;
  pointer-events: none;
}

.mando__flecha--izq {
  left: 10%;
}

.mando__flecha--der {
  right: 10%;
}

.mando__centro {
  grid-area: centro;
}

.mando__botones {
  grid-area: botones;
  justify-self: end;
  align-self: stretch;
  display: grid;
  /* One column on the right: Item on top, Frenar under it (where the thumb rests) */
  grid-template-columns: auto;
  grid-template-rows: 1fr auto;
  grid-template-areas:
    'item'
    'freno';
  justify-items: center;
  gap: 10px;
}

.mando__boton {
  border: 0;
  border-radius: 50%;
  color: #22170f;
  font: 400 1.3rem var(--font-title);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.45);
  touch-action: none;
}

.mando__boton.activo {
  transform: translateY(4px);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.45);
  filter: brightness(1.15);
}

.mando__boton--freno {
  grid-area: freno;
  align-self: end;
  width: min(26vw, 40vh, 160px);
  aspect-ratio: 1;
  background: #e4572e;
}

.mando__boton--item {
  grid-area: item;
  align-self: end;
  width: min(19vw, 30vh, 120px);
  aspect-ratio: 1;
  background: #f6c445;
}

/* Over the game (playing on the phone): see-through, and only the controls take touches */
.mando--superpuesto {
  position: absolute;
  inset: 0;
  align-items: end;
  padding: 12px 16px 14px;
  pointer-events: none;
}

.mando--superpuesto .mando__pad,
.mando--superpuesto .mando__boton,
.mando--superpuesto .mando__cambiar {
  pointer-events: auto;
}

.mando--superpuesto .mando__volante-zona {
  align-self: end;
}

/* Over the game the top left holds the room's panel: the switch goes at the bottom, in the middle */
.mando--superpuesto .mando__cambiar,
.mando--superpuesto .mando__aviso {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.mando--superpuesto .mando__cambiar {
  bottom: 12px;
}

.mando--superpuesto .mando__aviso {
  bottom: 44px;
  width: max-content;
  max-width: 50%;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(34, 23, 15, 0.7);
}

.mando--superpuesto .mando__pad {
  width: min(30vw, 46vh, 220px);
  background: radial-gradient(circle, rgba(34, 23, 15, 0.35), rgba(34, 23, 15, 0.15));
  border-color: rgba(241, 230, 204, 0.5);
}

.mando--superpuesto .mando__botones {
  align-self: end;
  height: min(68vh, 280px);
}

.mando--superpuesto .mando__boton {
  opacity: 0.88;
}

.mando--superpuesto .mando__boton--freno {
  width: min(20vw, 32vh, 140px);
}

.mando--superpuesto .mando__boton--item {
  width: min(15vw, 24vh, 100px);
}

/* Upright phone: the middle on top; under it, the wheel on the left and the buttons on the right */
@media (orientation: portrait) {
  .mando:not(.mando--superpuesto) {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr auto;
    grid-template-areas:
      'centro centro'
      'pad botones';
    align-items: end;
    padding-bottom: 32px;
  }

  .mando:not(.mando--superpuesto) .mando__centro {
    align-self: center;
    justify-self: center;
  }

  .mando:not(.mando--superpuesto) .mando__pad {
    width: min(44vw, 220px);
  }

  .mando:not(.mando--superpuesto) .mando__volante-zona {
    grid-area: pad;
  }

  .mando:not(.mando--superpuesto) .mando__botones {
    align-self: end;
  }

  .mando:not(.mando--superpuesto) .mando__boton--freno {
    width: min(26vw, 130px);
  }

  .mando:not(.mando--superpuesto) .mando__boton--item {
    width: min(20vw, 100px);
  }
}
</style>
