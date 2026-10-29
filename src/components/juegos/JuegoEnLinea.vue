<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watchEffect } from 'vue'
import QRCode from 'qrcode'
import { crearJuegoEnLinea } from '../../juego/enLinea.js'
import { crearMando } from '../../juego/entrada/tactil.js'
import { EVENTOS, MAX_JUGADORES } from '../../juego/compartido/protocolo'
import { colorCarro } from '../../juego/render/colores.js'
import AvisoPartida from './AvisoPartida.vue'
import LienzoJuego from './LienzoJuego.vue'
import MandoTactil from './MandoTactil.vue'
import PanelSonido from './PanelSonido.vue'
import ResultadosPartida from './ResultadosPartida.vue'
import TeclasJuego from './TeclasJuego.vue'

/** A room in play: the 3D view, the code to share, who's in and the score */
const props = defineProps({
  conexion: { type: Object, required: true },
  sala: { type: Object, required: true },
  partida: { type: Object, required: true },
  miId: { type: String, required: true },
  debug: { type: Boolean, default: false },
  /** Single player: add 2 bots and start as soon as the game is on screen */
  solo: { type: Boolean, default: false },
  /** Playing on the phone: the game on the whole screen with the controls over it (the car goes on its own) */
  celular: { type: Boolean, default: false },
})
const emit = defineEmits(['salir'])

const vista = ref(null)
const hud = ref({ kmh: 0, suelo: 'asfalto', derrape: 0, ping: null, vivo: true })
const salaActual = ref(props.sala)
const partidaActual = ref(props.partida)
const copiado = ref(false)
const error = ref('')
let juego = null
/** The game's sound, for the settings panel (set once the game is running) */
const sonido = shallowRef(null)

const esAnfitrion = computed(() => salaActual.value.anfitrion === props.miId)
/** id → { nombre, color } for the overlays */
const jugadores = computed(() =>
  Object.fromEntries(salaActual.value.jugadores.map((j) => [j.id, { nombre: j.nombre, color: colorCarro(j.color) }])),
)
const puntos = computed(() => Object.fromEntries(partidaActual.value.puntos.map((p) => [p.id, p.puntos])))
const enPartida = computed(() => partidaActual.value.fase !== 'espera')
/** Modo local: this computer is the shared screen; players join from their phones */
const pantalla = computed(() => !!salaActual.value.local)
const ligaControl = computed(() => `${location.origin}/control?sala=${encodeURIComponent(salaActual.value.codigo)}`)
const qr = ref('')
/** The game is on the whole screen (modo local): the side panel isn't visible, so a few things go over the game */
const completa = ref(false)
const alCambiarCompleta = () => (completa.value = !!document.fullscreenElement)
document.addEventListener('fullscreenchange', alCambiarCompleta)
function salirDeCompleta() {
  document.exitFullscreen?.().catch(() => {})
  vista.value?.enfocar()
}
/**
 * "Pantalla completa". On a computer: real full screen and the keyboard right back on the game.
 * On a phone (touch screen) the browser can't put just the game in full screen (iPhone only does it
 * with videos), so it goes phone-style: the game on the whole screen with the touch controls over
 * it, the same as joining from "Jugar en el celular"; the ✕ comes back to this view.
 */
const esTactil = () => window.matchMedia?.('(pointer: coarse)').matches
async function entrarACompleta() {
  if (esTactil()) return entrarACelular()
  await vista.value?.pantallaCompleta()
  vista.value?.enfocar()
}
watchEffect(async () => {
  if (!pantalla.value) return
  qr.value = await QRCode.toDataURL(ligaControl.value, { margin: 1, width: 240, color: { dark: '#22170F', light: '#F1E6CC' } })
})

const dejarPartida = props.conexion.escuchar(EVENTOS.partida, (p) => {
  // End of the match: fanfare if I won, a sad little tune if not
  if (p.fase === 'resultados' && partidaActual.value.fase !== 'resultados') {
    juego?.sonido.efecto(p.ganador === props.miId ? 'victoria' : 'derrota')
  }
  partidaActual.value = p
  if (p.fase !== 'espera') error.value = ''
})

/**
 * Phone-style: the game on the whole screen with the on-screen controls (joystick, Item, Frenar)
 * feeding it like the keyboard. From the start ("Jugar en el celular") or later with "Pantalla
 * completa" on a touch screen. The mando always exists, but switched off it reads as nothing
 * pressed (otherwise the car would go on its own on a computer).
 */
const modoCelular = ref(props.celular)
/** Got phone-style with "Pantalla completa": the ✕ comes back instead of leaving the room */
const celularPorBoton = ref(false)
const mando = crearMando({ activo: props.celular })
// ?debug: the touch controls' state, for testing tools
if (props.debug) window.__mando = mando.estado
let candado = null
/** The controls hide when you're out (a tap on the picture throws a meteor) and on the results */
const conMando = computed(() => modoCelular.value && hud.value.vivo !== false && partidaActual.value.fase !== 'resultados')

async function entrarACelular() {
  modoCelular.value = true
  celularPorBoton.value = true
  mando.estado.activo = true
  // Real full screen of the page where the browser allows it (Android); the layout works without it
  document.documentElement.requestFullscreen?.().catch(() => {})
  screen.orientation?.lock?.('landscape').catch(() => {})
  candado = await navigator.wakeLock?.request('screen').catch(() => null)
}

function salirDeCelular() {
  modoCelular.value = false
  celularPorBoton.value = false
  mando.estado.activo = false
  mando.soltarTodo()
  candado?.release?.().catch(() => {})
  candado = null
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
}
const miColor = computed(() => jugadores.value[props.miId]?.color)

onMounted(async () => {
  juego = crearJuegoEnLinea(vista.value.lienzo, {
    conexion: props.conexion,
    sala: props.sala,
    miId: props.miId,
    alEstado: (e) => (hud.value = e),
    alCambiarSala: (s) => (salaActual.value = s),
    debug: props.debug,
    mando,
    ligero: props.celular,
  })
  if (props.celular) {
    screen.orientation?.lock?.('landscape').catch(() => {})
    candado = await navigator.wakeLock?.request('screen').catch(() => null)
  }
  sonido.value = juego.sonido
  vista.value.enfocar()
  // Here and not before: the game is already listening, so it sees the bots arrive and the countdown
  if (props.solo && (await ponerBots(2))) await empezar()
})

const bots = computed(() => salaActual.value.jugadores.filter((j) => j.bot).length)

/** Host only, in the waiting room: how many bots are in */
async function ponerBots(cantidad) {
  error.value = ''
  try {
    const r = await props.conexion.pedir(EVENTOS.bots, { cantidad })
    if (!r.ok) error.value = r.error
    return r.ok
  } catch (e) {
    error.value = e.message
    return false
  } finally {
    vista.value?.enfocar()
  }
}

onBeforeUnmount(() => {
  candado?.release?.().catch(() => {})
  document.removeEventListener('fullscreenchange', alCambiarCompleta)
  if (document.fullscreenElement) salirDeCompleta()
  dejarPartida()
  juego?.destruir()
})

/** 3 · 2 · 1 beeps and a higher one for "¡Ya!" */
function sonarAviso(texto) {
  if (/^\d$/.test(texto)) juego?.sonido.efecto('cuenta')
  else if (texto === '¡Ya!') juego?.sonido.efecto('arranque')
}

async function empezar() {
  error.value = ''
  try {
    const r = await props.conexion.pedir(EVENTOS.empezar)
    if (!r.ok) error.value = r.error
  } catch (e) {
    error.value = e.message
  }
  vista.value?.enfocar()
}

async function copiarCodigo() {
  try {
    await navigator.clipboard.writeText(salaActual.value.codigo)
    copiado.value = true
    setTimeout(() => (copiado.value = false), 1500)
  } catch {
    // Without clipboard permission the code is still on screen
  }
}
</script>

<template>
  <div class="en-linea" :class="{ 'en-linea--celular': modoCelular }">
    <LienzoJuego
      ref="vista"
      :hud="hud"
      :debug="debug"
      :pantalla="pantalla"
      :celular="modoCelular"
      @tecla="juego?.sonido.activar()"
    >
      <AvisoPartida
        :partida="partidaActual"
        :vivo="hud.vivo"
        :meteoritos="!!hud.meteorito"
        :jugadores="jugadores"
        @cambio="sonarAviso"
      />
      <ResultadosPartida
        v-if="partidaActual.fase === 'resultados'"
        :partida="partidaActual"
        :jugadores="jugadores"
        :es-anfitrion="esAnfitrion"
        :anfitrion="salaActual.anfitrion"
        :error="error"
        @otra-vez="empezar"
        @salir="emit('salir')"
      />

      <!-- Full screen: what the side panel would show. In modo local it goes on the right (with the
           QR); playing on your own computer, on the left (your item is in the top right corner) -->
      <!-- On the phone: the controls over the game, in your car's color -->
      <MandoTactil v-if="conMando" :mando="mando" superpuesto :style="{ '--color': miColor }" />
      <p v-if="modoCelular" class="en-linea__girar">Gira tu celular para jugar</p>

      <template v-if="completa || modoCelular">
        <button
          v-if="modoCelular"
          type="button"
          class="en-linea__salir-completa"
          :title="celularPorBoton ? 'Salir de pantalla completa' : 'Salir de la sala'"
          @click="celularPorBoton ? salirDeCelular() : emit('salir')"
        >
          ✕
        </button>
        <button
          v-else
          type="button"
          class="en-linea__salir-completa"
          title="Salir de pantalla completa (Esc)"
          @click="salirDeCompleta"
        >
          ✕
        </button>
        <div
          v-if="partidaActual.fase === 'espera'"
          class="en-linea__unirse-completa"
          :class="{ 'en-linea__completa--izquierda': !pantalla }"
        >
          <img v-if="pantalla && qr" :src="qr" width="150" height="150" alt="Código QR para unirse desde el celular" />
          <div>
            <p class="en-linea__etiqueta">{{ pantalla ? 'Únete con tu celular' : 'Código de la sala' }}</p>
            <p class="en-linea__codigo en-linea__codigo--fijo">{{ salaActual.codigo }}</p>
            <ul class="en-linea__mini-jugadores">
              <li v-for="j in salaActual.jugadores" :key="j.id">
                <span class="en-linea__color" :style="{ background: colorCarro(j.color) }"></span>{{ j.nombre }}
              </li>
            </ul>
            <div v-if="esAnfitrion" class="en-linea__botones">
              <button type="button" class="btn btn--sm" :disabled="salaActual.jugadores.length < 2" @click="empezar">
                Empezar partida
              </button>
              <button
                type="button"
                class="btn btn--sm btn--ghost"
                :disabled="salaActual.jugadores.length >= MAX_JUGADORES"
                @click="ponerBots(bots + 1)"
              >
                + Bot
              </button>
            </div>
            <p v-else class="en-linea__nota">Esperando a que {{ jugadores[salaActual.anfitrion]?.nombre }} empiece.</p>
            <p v-if="error" class="en-linea__error" role="alert">{{ error }}</p>
          </div>
        </div>
        <ul
          v-else
          class="en-linea__marcador-completa"
          :class="{ 'en-linea__completa--izquierda': !pantalla }"
          aria-label="Puntos"
        >
          <li v-for="j in salaActual.jugadores" :key="j.id">
            <span class="en-linea__color" :style="{ background: colorCarro(j.color) }"></span>
            <span>{{ j.nombre }}</span>
            <strong>{{ puntos[j.id] ?? 0 }}<small>/{{ partidaActual.meta }}</small></strong>
          </li>
        </ul>
      </template>
    </LienzoJuego>

    <aside v-if="!modoCelular" class="en-linea__sala card" aria-label="Sala">
      <template v-if="pantalla">
        <p class="en-linea__etiqueta muted">Modo local · únete con tu celular</p>
        <img v-if="qr" :src="qr" class="en-linea__qr" width="240" height="240" alt="Código QR para unirse desde el celular" />
        <p class="en-linea__nota muted">
          O abre <strong>{{ ligaControl.replace(/^https?:\/\//, '').replace(/\?.*$/, '') }}</strong> y escribe el código
        </p>
        <p class="en-linea__codigo en-linea__codigo--fijo">{{ salaActual.codigo }}</p>
        <button type="button" class="btn btn--sm" @click="vista?.pantallaCompleta()">Pantalla completa</button>
      </template>
      <template v-else>
        <p class="en-linea__etiqueta muted">Código de la sala</p>
        <button type="button" class="en-linea__codigo" title="Copiar código" @click="copiarCodigo">
          {{ salaActual.codigo }}
        </button>
        <p class="en-linea__nota muted">{{ copiado ? '¡Copiado!' : 'Compártelo para que se unan tus amigos.' }}</p>
        <button type="button" class="btn btn--sm btn--ghost en-linea__completa-boton" @click="entrarACompleta">
          Pantalla completa
        </button>
      </template>

      <h3 class="en-linea__titulo">Jugadores {{ salaActual.jugadores.length }}/{{ MAX_JUGADORES }}</h3>
      <ul class="en-linea__jugadores">
        <li v-for="j in salaActual.jugadores" :key="j.id">
          <span class="en-linea__color" :style="{ background: colorCarro(j.color) }"></span>
          <span class="en-linea__nombre">{{ j.nombre }}</span>
          <span v-if="j.id === miId" class="chip">tú</span>
          <span v-if="j.bot" class="chip">bot</span>
          <span v-if="j.id === salaActual.anfitrion" class="en-linea__anfitrion" title="Creó la sala">★</span>
          <span v-if="enPartida" class="en-linea__puntos" :title="`${puntos[j.id] ?? 0} de ${partidaActual.meta} puntos`">
            {{ puntos[j.id] ?? 0 }}<small>/{{ partidaActual.meta }}</small>
          </span>
        </li>
      </ul>

      <template v-if="partidaActual.fase === 'espera'">
        <button
          v-if="esAnfitrion"
          type="button"
          class="btn"
          :disabled="salaActual.jugadores.length < 2"
          @click="empezar"
        >
          Empezar partida
        </button>
        <div v-if="esAnfitrion" class="en-linea__botones">
          <button
            type="button"
            class="btn btn--sm btn--ghost"
            :disabled="salaActual.jugadores.length >= MAX_JUGADORES"
            @click="ponerBots(bots + 1)"
          >
            + Agregar bot
          </button>
          <button v-if="bots" type="button" class="btn btn--sm btn--ghost" @click="ponerBots(0)">Quitar bots</button>
        </div>
        <p class="en-linea__nota muted">
          <template v-if="pantalla && !salaActual.jugadores.length">Esperando a que alguien se una desde su celular.</template>
          <template v-else-if="salaActual.jugadores.length < 2">
            Mientras llega alguien más, maneja libre. Se juega desde 2 (los bots cuentan).
          </template>
          <template v-else-if="!esAnfitrion">Esperando a que {{ jugadores[salaActual.anfitrion]?.nombre }} empiece.</template>
          <template v-else>El último carro en pantalla gana la ronda; el primero en {{ partidaActual.meta }} gana.</template>
        </p>
        <p v-if="error" class="en-linea__error" role="alert">{{ error }}</p>
      </template>
      <p v-else class="en-linea__nota muted">Ronda {{ partidaActual.ronda }} · gana el primero en {{ partidaActual.meta }}</p>

      <details class="en-linea__sonido">
        <summary>Sonido</summary>
        <PanelSonido :sonido="sonido" @listo="vista?.enfocar()" />
      </details>

      <button type="button" class="btn btn--sm btn--ghost en-linea__salir" @click="emit('salir')">Salir de la sala</button>
    </aside>

    <TeclasJuego v-if="!pantalla && !modoCelular" class="en-linea__ayuda" />
  </div>
</template>

<style scoped>
.en-linea {
  display: grid;
  gap: 16px;
}

@media (min-width: 960px) {
  .en-linea {
    grid-template-columns: minmax(0, 1fr) 260px;
  }

  .en-linea__ayuda {
    grid-column: 1;
  }
}

.en-linea__sala {
  padding: 16px;
  display: grid;
  gap: 6px;
  align-content: start;
}

.en-linea__etiqueta,
.en-linea__nota {
  margin: 0;
  font-size: 0.85rem;
}

.en-linea__codigo {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-ink);
  font: 400 2.4rem var(--font-title);
  letter-spacing: 0.04em;
  cursor: copy;
}

.en-linea__salir-completa {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: rgba(34, 23, 15, 0.7);
  color: #f1e6cc;
  font-size: 1rem;
  cursor: pointer;
}

.en-linea__unirse-completa {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 14px;
  border-radius: 16px;
  background: rgba(241, 230, 204, 0.94);
  color: #22170f;
  max-width: calc(100% - 32px);
}

.en-linea__unirse-completa img {
  border-radius: 8px;
  border: 3px solid #22170f;
}

.en-linea__unirse-completa .en-linea__codigo {
  font-size: 2rem;
}

.en-linea__mini-jugadores {
  list-style: none;
  margin: 6px 0 10px;
  padding: 0;
  display: grid;
  gap: 4px;
}

.en-linea__mini-jugadores li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.en-linea__unirse-completa.en-linea__completa--izquierda,
.en-linea__marcador-completa.en-linea__completa--izquierda {
  right: auto;
  left: 12px;
  top: 56px;
}

.en-linea__completa-boton {
  justify-self: start;
}

.en-linea__marcador-completa {
  position: absolute;
  top: 12px;
  right: 12px;
  list-style: none;
  margin: 0;
  padding: 8px 12px;
  display: grid;
  gap: 4px;
  border-radius: 12px;
  background: rgba(34, 23, 15, 0.72);
  color: #f1e6cc;
}

.en-linea__marcador-completa li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.en-linea__marcador-completa strong {
  margin-left: auto;
  padding-left: 12px;
  font: 400 1.3rem var(--font-title);
}

.en-linea__marcador-completa small {
  font-size: 0.75rem;
  opacity: 0.7;
}

/* Phone held upright: the 16:9 game would be tiny; ask to turn it */
.en-linea__girar {
  display: none;
}

@media (orientation: portrait) {
  .en-linea__girar {
    display: grid;
    place-items: center;
    position: fixed;
    inset: 0;
    z-index: 5;
    margin: 0;
    padding: 24px;
    background: rgba(34, 23, 15, 0.92);
    color: #f1e6cc;
    font: 400 1.8rem var(--font-title);
    text-align: center;
  }
}

/* On the phone: smaller panels, kept clear of the joystick (bottom left) */
.en-linea--celular .en-linea__unirse-completa,
.en-linea--celular .en-linea__marcador-completa {
  top: 52px;
  left: 10px;
  right: auto;
  padding: 8px 10px;
  font-size: 0.8rem;
}

.en-linea--celular .en-linea__unirse-completa .en-linea__codigo {
  font-size: 1.4rem;
}

.en-linea--celular .en-linea__mini-jugadores {
  margin: 2px 0 6px;
  gap: 1px;
}

.en-linea--celular .en-linea__marcador-completa strong {
  font-size: 1rem;
}

.en-linea--celular .en-linea__salir-completa {
  top: 10px;
  left: 10px;
}

.en-linea__qr {
  justify-self: center;
  width: 100%;
  max-width: 240px;
  height: auto;
  border-radius: 12px;
  border: 3px solid var(--text);
}

.en-linea__codigo--fijo {
  margin: 0;
  cursor: default;
}

.en-linea__titulo {
  margin: 12px 0 2px;
  font-size: 1.4rem;
}

.en-linea__jugadores {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: grid;
  gap: 6px;
}

.en-linea__jugadores li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.en-linea__color {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--text);
  flex: none;
}

.en-linea__nombre {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.en-linea__anfitrion {
  color: var(--accent-ink);
}

.en-linea__puntos {
  margin-left: auto;
  font-family: var(--font-title);
  font-size: 1.3rem;
}

.en-linea__puntos small {
  font-size: 0.8rem;
  color: var(--muted);
}

.en-linea__sonido {
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.en-linea__sonido > summary {
  cursor: pointer;
  font: 400 1.4rem var(--font-title);
  margin-bottom: 4px;
}

.en-linea__salir {
  justify-self: start;
}

.en-linea__botones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.en-linea__error {
  margin: 0;
  color: var(--extremo);
  font-weight: 600;
}
</style>
