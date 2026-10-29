<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { EVENTOS, LARGO_NOMBRE, desempacarCarro } from '../../juego/compartido/protocolo'
import { crearConexion } from '../../juego/red/conexion.js'
import { colorCarro } from '../../juego/render/colores.js'
import { iconoItem } from '../../juego/render/iconos.js'
import { crearMando } from '../../juego/entrada/tactil.js'
import ITEMS from '../../juego/datos/items.json'
import MandoTactil from './MandoTactil.vue'

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

/** The on-screen controller (joystick, Item, Frenar) writes here; one control goes out per tick */
const mando = crearMando()
let seq = 0
let reloj = 0
let candado = null

function enviar() {
  if (!juego.value) return
  seq++
  juego.value.conexion.emitir(EVENTOS.controles, { seq, ...mando.leer() })
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
  mando.soltarTodo()
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

    <MandoTactil :mando="mando">
      <div class="control__item" :class="{ 'control__item--vacio': !item }">
        <img v-if="item" :src="iconoItem(item)" alt="" />
        <span>{{ item ? item.nombre : 'Sin item' }}</span>
      </div>
    </MandoTactil>
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

.control__girar {
  display: none;
}

/* Upright phone: still usable (the controller stacks itself), with a hint to turn it */
@media (orientation: portrait) {
  .control__item {
    max-width: none;
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
