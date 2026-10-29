<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { EVENTOS, LARGO_NOMBRE, desempacarCarro } from '../../juego/compartido/protocolo'
import { crearConexion } from '../../juego/red/conexion.js'
import { colorCarro } from '../../juego/render/colores.js'
import { iconoItem } from '../../juego/render/iconos.js'
import ITEMS from '../../juego/datos/items.json'

/**
 * Proyecto #3, modo local: the phone as a game controller. Everyone looks at the same screen (a
 * computer that created the room in "modo local"); here you type your name, join with the room
 * code (it comes in the QR's link) and the phone turns into the controller: a joystick to steer
 * on the left, and Frenar and Item on the right. The car goes on its own (always on the gas)
 * unless you brake: with one thumb on the wheel, there's only one button left to think about.
 *
 * The phone is a regular player for the server: it sends one control per tick, numbered, like
 * the keyboard does in the browser game. It draws nothing of the race; it only reads its own
 * car from the snapshots (alive, item) to show it and to buzz when something happens to it.
 */
const GUARDADO = 'carreras:control'
const ZONA_MUERTA = 0.12
const route = useRoute()

const nombre = ref(leerNombre())
const codigo = ref(String(route.query.sala ?? ''))
const error = ref('')
const conectando = ref(false)
/** While playing: { conexion, sala, miId } */
const juego = ref(null)
const fase = ref('espera')
const vivo = ref(true)
const item = ref(null)
const puntos = ref(0)
const meta = ref(5)
const aviso = ref('')

function leerNombre() {
  try {
    return localStorage.getItem(GUARDADO) ?? ''
  } catch {
    return ''
  }
}

const yo = computed(() => juego.value?.sala.jugadores.find((j) => j.id === juego.value.miId))
const color = computed(() => (yo.value ? colorCarro(yo.value.color) : '#F1E6CC'))
const estado = computed(() => {
  if (aviso.value) return aviso.value
  if (fase.value === 'espera') return 'Esperando a que empiece la partida'
  if (fase.value === 'cuenta') return '¡Prepárate!'
  if (fase.value === 'resultados') return 'Fin de la partida'
  if (fase.value === 'ronda-fin') return 'Fin de la ronda'
  return vivo.value ? '¡A correr!' : '¡Kaboom! Espera la siguiente ronda'
})

/* ------------------------------- Controls ------------------------------- */

const giro = ref(0)
const freno = ref(false)
let itemPendiente = false
const itemApretado = ref(false)
let seq = 0
let reloj = 0
let candado = null

function enviar() {
  if (!juego.value) return
  seq++
  juego.value.conexion.emitir(EVENTOS.controles, {
    seq,
    giro: giro.value,
    // Always on the gas, except while braking (stopped, braking backs up)
    acel: freno.value ? 0 : 1,
    freno: freno.value ? 1 : 0,
    mano: false,
    item: itemApretado.value || itemPendiente,
  })
  itemPendiente = false
}

/** Joystick: only left and right matter (steering); the knob follows the finger inside the pad */
const pad = ref(null)
const perilla = ref({ x: 0, y: 0 })
let dedoPad = null

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
  giro.value = Math.max(-1, Math.min(1, x))
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
  giro.value = 0
}

/** A button: held while the finger is on it */
function boton(cual) {
  return {
    onPointerdown(e) {
      capturar(e.currentTarget, e)
      if (cual === 'freno') freno.value = true
      if (cual === 'item') {
        itemApretado.value = true
        itemPendiente = true
      }
      navigator.vibrate?.(12)
    },
    onPointerup: () => soltar(cual),
    onPointercancel: () => soltar(cual),
  }
}

function soltar(cual) {
  if (cual === 'freno') freno.value = false
  if (cual === 'item') itemApretado.value = false
}

/* ------------------------------ Joining ------------------------------ */

async function unirse() {
  error.value = ''
  if (!nombre.value.trim()) return (error.value = 'Escribe tu nombre')
  if (!codigo.value.trim()) return (error.value = 'Escribe el código que sale en la pantalla')
  try {
    localStorage.setItem(GUARDADO, nombre.value.trim())
  } catch {
    // Private mode: nothing to remember
  }
  // Full screen and landscape, if the phone lets us (it has to be right on the tap)
  document.documentElement.requestFullscreen?.().catch(() => {})
  screen.orientation?.lock?.('landscape').catch(() => {})
  conectando.value = true
  const conexion = crearConexion()
  try {
    await conexion.abierta()
    const r = await conexion.pedir(EVENTOS.unirse, { nombre: nombre.value, codigo: codigo.value })
    if (!r.ok) throw new Error(r.error)
    juego.value = { conexion, sala: r.sala, miId: r.id }
    fase.value = r.partida.fase
    meta.value = r.partida.meta
    escuchar(conexion)
    reloj = setInterval(enviar, 1000 / r.sala.tickHz)
    candado = await navigator.wakeLock?.request('screen').catch(() => null)
  } catch (e) {
    conexion.cerrar()
    error.value = e.message
  } finally {
    conectando.value = false
  }
}

function escuchar(conexion) {
  conexion.escuchar(EVENTOS.sala, (sala) => (juego.value = { ...juego.value, sala }))
  conexion.escuchar(EVENTOS.partida, (p) => {
    fase.value = p.fase
    meta.value = p.meta
    puntos.value = p.puntos.find((x) => x.id === juego.value?.miId)?.puntos ?? 0
    if (p.fase === 'resultados') navigator.vibrate?.(p.ganador === juego.value?.miId ? [80, 60, 80, 60, 200] : 200)
  })
  conexion.escuchar(EVENTOS.estado, (inst) => {
    const mio = inst.c.find((c) => c[0] === juego.value?.miId)
    if (!mio) return
    const { vivo: v, item: i } = desempacarCarro(mio)
    vivo.value = v
    item.value = ITEMS[i] ?? null
  })
  conexion.escuchar(EVENTOS.evento, (e) => {
    const miId = juego.value?.miId
    if (e.tipo === 'explosion' && e.id === miId) navigator.vibrate?.([60, 40, 250])
    else if ((e.tipo === 'golpe' && e.id === miId) || (e.tipo === 'atropello' && e.quien === miId)) navigator.vibrate?.(90)
    else if (e.tipo === 'choque' && e.ids.includes(miId)) navigator.vibrate?.(Math.min(120, 20 + e.fuerza * 4))
    else if (e.tipo === 'item' && e.id === miId) navigator.vibrate?.(30)
  })
  conexion.escuchar(EVENTOS.cerrada, () => terminar('La pantalla cerró la sala'))
  conexion.alCerrarse(() => terminar('Se perdió la conexión con el servidor'))
}

function terminar(motivo = '') {
  clearInterval(reloj)
  candado?.release?.().catch(() => {})
  candado = null
  juego.value?.conexion.cerrar()
  juego.value = null
  error.value = motivo
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
}

onBeforeUnmount(() => terminar())
</script>

<template>
  <section v-if="!juego" class="control-entrar card">
    <h2>Usa tu celular como control</h2>
    <p class="muted">Pon tu nombre y el código que sale en la pantalla. Todos ven la misma pantalla.</p>
    <form @submit.prevent="unirse">
      <div class="field">
        <label for="control-nombre">Tu nombre</label>
        <input id="control-nombre" v-model="nombre" class="input" :maxlength="LARGO_NOMBRE" autocomplete="nickname" />
      </div>
      <div class="field">
        <label for="control-codigo">Código de la sala</label>
        <input id="control-codigo" v-model="codigo" class="input control-entrar__codigo" placeholder="HMO-0000" autocomplete="off" />
      </div>
      <button type="submit" class="btn" :disabled="conectando">{{ conectando ? 'Conectando…' : 'Unirse' }}</button>
      <p v-if="error" class="control-entrar__error" role="alert">{{ error }}</p>
    </form>
  </section>

  <div v-else class="control" :style="{ '--color': color }">
    <header class="control__barra">
      <span class="control__color"></span>
      <strong>{{ yo?.nombre ?? nombre }}</strong>
      <span class="control__estado">{{ estado }}</span>
      <span v-if="fase !== 'espera'" class="control__puntos">{{ puntos }}<small>/{{ meta }}</small></span>
      <button type="button" class="control__salir" @click="terminar()">Salir</button>
    </header>

    <div class="control__cuerpo">
      <div
        ref="pad"
        class="control__pad"
        aria-label="Volante: desliza a la izquierda o a la derecha"
        @pointerdown="tocarPad"
        @pointermove="dedoPad !== null && moverPad($event)"
        @pointerup="soltarPad"
        @pointercancel="soltarPad"
      >
        <span class="control__flecha control__flecha--izq">◀</span>
        <span class="control__flecha control__flecha--der">▶</span>
        <span class="control__perilla" :style="{ transform: `translate(${perilla.x * 60}%, ${perilla.y * 60}%)` }"></span>
      </div>

      <div class="control__item" :class="{ 'control__item--vacio': !item }">
        <img v-if="item" :src="iconoItem(item)" alt="" />
        <span>{{ item ? item.nombre : 'Sin item' }}</span>
      </div>

      <div class="control__botones">
        <button type="button" class="control__boton control__boton--item" :class="{ activo: itemApretado }" v-bind="boton('item')">
          Item
        </button>
        <button type="button" class="control__boton control__boton--freno" :class="{ activo: freno }" v-bind="boton('freno')">
          Frenar
        </button>
      </div>
    </div>
    <p class="control__girar">Gira tu celular para jugar más cómodo</p>
  </div>
</template>

<style scoped>
.control-entrar {
  max-width: 420px;
  margin: 0 auto;
  padding: 20px;
  display: grid;
  gap: 10px;
}

.control-entrar h2 {
  margin: 0;
  font-size: 1.8rem;
}

.control-entrar p {
  margin: 0;
}

.control-entrar form {
  display: grid;
  gap: 12px;
}

.control-entrar__codigo {
  text-transform: uppercase;
}

.control-entrar__error {
  color: var(--extremo);
  font-weight: 600;
}

/* The controller: full screen, dark, no scrolling, no zoom, no text selection */
.control {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  grid-template-rows: auto 1fr;
  /* Never wider than the phone: a long status line gets cut with "…" instead of pushing everything */
  grid-template-columns: minmax(0, 1fr);
  background: #1c140d;
  color: #f1e6cc;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  overscroll-behavior: none;
}

.control__barra {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(241, 230, 204, 0.06);
  font-size: 0.95rem;
}

.control__color {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color);
  border: 2px solid #f1e6cc;
  flex: none;
}

.control__estado {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}

.control__puntos {
  font: 400 1.4rem var(--font-title);
}

.control__puntos small {
  font-size: 0.8rem;
  opacity: 0.7;
}

.control__salir {
  border: 1px solid rgba(241, 230, 204, 0.3);
  border-radius: 999px;
  background: none;
  color: inherit;
  padding: 4px 12px;
}

.control__cuerpo {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 12px 20px 20px;
}

.control__pad {
  justify-self: start;
  position: relative;
  width: min(42vw, 62vh, 260px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(241, 230, 204, 0.12), rgba(241, 230, 204, 0.04));
  border: 3px solid rgba(241, 230, 204, 0.25);
  display: grid;
  place-items: center;
}

.control__perilla {
  width: 42%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--color);
  border: 4px solid #f1e6cc;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.control__flecha {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.35;
  font-size: 1.4rem;
  pointer-events: none;
}

.control__flecha--izq {
  left: 10%;
}

.control__flecha--der {
  right: 10%;
}

.control__item {
  display: grid;
  justify-items: center;
  gap: 4px;
  font-size: 0.85rem;
  text-align: center;
  max-width: 120px;
}

.control__item img {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: #f1e6cc;
}

.control__item--vacio {
  opacity: 0.5;
}

.control__botones {
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

.control__boton {
  border: 0;
  border-radius: 50%;
  color: #22170f;
  font: 400 1.3rem var(--font-title);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.45);
  touch-action: none;
}

.control__boton.activo {
  transform: translateY(4px);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.45);
  filter: brightness(1.15);
}

.control__boton--freno {
  grid-area: freno;
  align-self: end;
  width: min(26vw, 40vh, 160px);
  aspect-ratio: 1;
  background: #e4572e;
}

.control__boton--item {
  grid-area: item;
  align-self: end;
  width: min(19vw, 30vh, 120px);
  aspect-ratio: 1;
  background: #f6c445;
}

.control__girar {
  display: none;
}

/* Upright phone: still usable, but everything stacked and a hint to turn it */
@media (orientation: portrait) {
  /* The item in the middle; under it, the wheel on the left and the buttons on the right */
  .control__cuerpo {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr auto;
    grid-template-areas:
      'item item'
      'pad botones';
    align-items: end;
    padding-bottom: 32px;
  }

  .control__item {
    grid-area: item;
    align-self: center;
    justify-self: center;
    max-width: none;
  }

  .control__pad {
    grid-area: pad;
    width: min(44vw, 220px);
  }

  .control__botones {
    grid-area: botones;
    align-self: end;
  }

  .control__boton--freno {
    width: min(26vw, 130px);
  }

  .control__boton--item {
    width: min(20vw, 100px);
  }

  .control__girar {
    display: block;
    position: absolute;
    top: 52px;
    left: 0;
    right: 0;
    margin: 0;
    text-align: center;
    font-size: 0.8rem;
    opacity: 0.6;
  }
}
</style>
