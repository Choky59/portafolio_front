<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { crearJuegoEnLinea } from '../../juego/enLinea.js'
import { EVENTOS, MAX_JUGADORES } from '../../juego/compartido/protocolo'
import { colorCarro } from '../../juego/render/colores.js'
import AvisoPartida from './AvisoPartida.vue'
import LienzoJuego from './LienzoJuego.vue'
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
})
const emit = defineEmits(['salir'])

const vista = ref(null)
const hud = ref({ kmh: 0, suelo: 'asfalto', derrape: 0, ping: null, vivo: true })
const salaActual = ref(props.sala)
const partidaActual = ref(props.partida)
const copiado = ref(false)
const error = ref('')
let juego = null

const esAnfitrion = computed(() => salaActual.value.anfitrion === props.miId)
/** id → { nombre, color } for the overlays */
const jugadores = computed(() =>
  Object.fromEntries(salaActual.value.jugadores.map((j) => [j.id, { nombre: j.nombre, color: colorCarro(j.color) }])),
)
const puntos = computed(() => Object.fromEntries(partidaActual.value.puntos.map((p) => [p.id, p.puntos])))
const enPartida = computed(() => partidaActual.value.fase !== 'espera')

const dejarPartida = props.conexion.escuchar(EVENTOS.partida, (p) => {
  partidaActual.value = p
  if (p.fase !== 'espera') error.value = ''
})

onMounted(async () => {
  juego = crearJuegoEnLinea(vista.value.lienzo, {
    conexion: props.conexion,
    sala: props.sala,
    miId: props.miId,
    alEstado: (e) => (hud.value = e),
    alCambiarSala: (s) => (salaActual.value = s),
    debug: props.debug,
  })
  silencio.value = juego.sonido.silencio
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
  dejarPartida()
  juego?.destruir()
})

const silencio = ref(false)
function alternarSilencio() {
  if (juego) silencio.value = juego.sonido.alternarSilencio()
  vista.value?.enfocar()
}

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
  <div class="en-linea">
    <LienzoJuego ref="vista" :hud="hud" :debug="debug" @tecla="juego?.sonido.activar()">
      <AvisoPartida :partida="partidaActual" :vivo="hud.vivo" :jugadores="jugadores" @cambio="sonarAviso" />
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
    </LienzoJuego>

    <aside class="en-linea__sala card" aria-label="Sala">
      <p class="en-linea__etiqueta muted">Código de la sala</p>
      <button type="button" class="en-linea__codigo" title="Copiar código" @click="copiarCodigo">
        {{ salaActual.codigo }}
      </button>
      <p class="en-linea__nota muted">{{ copiado ? '¡Copiado!' : 'Compártelo para que se unan tus amigos.' }}</p>

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
          <template v-if="salaActual.jugadores.length < 2">Mientras llega alguien más, maneja libre. Se juega desde 2 (los bots cuentan).</template>
          <template v-else-if="!esAnfitrion">Esperando a que {{ jugadores[salaActual.anfitrion]?.nombre }} empiece.</template>
          <template v-else>El último carro en pantalla gana la ronda; el primero en {{ partidaActual.meta }} gana.</template>
        </p>
        <p v-if="error" class="en-linea__error" role="alert">{{ error }}</p>
      </template>
      <p v-else class="en-linea__nota muted">Ronda {{ partidaActual.ronda }} · gana el primero en {{ partidaActual.meta }}</p>

      <div class="en-linea__botones">
        <button type="button" class="btn btn--sm btn--ghost" :aria-pressed="silencio" @click="alternarSilencio">
          {{ silencio ? 'Sin sonido' : 'Con sonido' }}
        </button>
        <button type="button" class="btn btn--sm btn--ghost" @click="emit('salir')">Salir de la sala</button>
      </div>
    </aside>

    <TeclasJuego class="en-linea__ayuda" />
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
