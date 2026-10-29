<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { CATEGORIAS, COLORES, EVENTOS, LARGO_NOMBRE, MAX_JUGADORES } from '../../juego/compartido/protocolo'
import { crearConexion } from '../../juego/red/conexion.js'
import { iconoItem } from '../../juego/render/iconos.js'
import { miniMapa } from '../../juego/render/miniMapa.js'
import ITEMS from '../../juego/datos/items.json'
import JuegoEnLinea from './JuegoEnLinea.vue'

/**
 * Proyecto #3's game: pick a name and a color, then create a room on one of the maps (and
 * share its code), join one with a code, or pick one from the list of open rooms. Name, color
 * and map are remembered in this browser.
 *
 * The lobby keeps one connection to the game server: it asks for the open rooms every few
 * seconds and, when you create or join one, that same connection becomes the game's.
 */
const CADA_LISTA = 3000
/** The items that come out of boxes (the grill, for example, only appears from the smoke) */
const ITEMS_CAJAS = ITEMS.filter((i) => i.probabilidad > 0)
/** The same, grouped by the box color they come out of */
const GRUPOS_CAJAS = CATEGORIAS.map((c) => ({ ...c, items: ITEMS_CAJAS.filter((i) => i.categoria === c.id) })).filter((g) => g.items.length)
const GUARDADO = 'carreras:jugador'
/** The maps you can pick (test circuits are marked `oculto`), Hermosillo first */
const MAPAS = Object.values(import.meta.glob('../../juego/datos/circuitos/*.json', { eager: true, import: 'default' }))
  .filter((c) => !c.oculto)
  .sort((a, b) => (a.id === 'hermosillo' ? -1 : b.id === 'hermosillo' ? 1 : a.nombre.localeCompare(b.nombre)))
const nombreMapa = (id) => MAPAS.find((m) => m.id === id)?.nombre ?? id
const route = useRoute()

const guardado = leerGuardado()
const nombre = ref(guardado.nombre ?? '')
const color = ref(COLORES.some((c) => c.id === guardado.color) ? guardado.color : COLORES[0].id)
const mapa = ref(MAPAS.some((m) => m.id === guardado.mapa) ? guardado.mapa : MAPAS[0].id)
const codigo = ref('')
const conectando = ref(false)
const error = ref('')
/** { conexion, sala, estado (of the match), miId } while in a room */
const partida = shallowRef(null)

function leerGuardado() {
  try {
    return JSON.parse(localStorage.getItem(GUARDADO)) ?? {}
  } catch {
    return {}
  }
}

function guardar() {
  try {
    localStorage.setItem(GUARDADO, JSON.stringify({ nombre: nombre.value.trim(), color: color.value, mapa: mapa.value }))
  } catch {
    // Private mode: nothing to remember
  }
}

/* ------------------------- Connection and room list ------------------------- */

/** The lobby's connection (not in any room yet); null until needed or after it failed */
let conexionLobby = null
/** Rooms you can join, refreshed every few seconds; null until the first answer */
const salas = ref(null)
let reloj = null

async function obtenerConexion() {
  if (conexionLobby) return conexionLobby
  // ?lag=150&jitter=40 simulates a far-away server (ms, round trip + random variation)
  const conexion = crearConexion({ lag: Number(route.query.lag) || 0, jitter: Number(route.query.jitter) || 0 })
  try {
    await conexion.abierta()
  } catch (e) {
    conexion.cerrar()
    throw e
  }
  conexionLobby = conexion
  conexion.alCerrarse(() => {
    if (conexionLobby === conexion) conexionLobby = null
  })
  return conexion
}

async function refrescarSalas() {
  if (partida.value || conectando.value || document.hidden) return
  try {
    const conexion = await obtenerConexion()
    salas.value = await conexion.pedir(EVENTOS.salas)
  } catch {
    // The server is unreachable for now: try again on the next round
    conexionLobby?.cerrar()
    conexionLobby = null
  }
}

onMounted(() => {
  refrescarSalas()
  reloj = setInterval(refrescarSalas, CADA_LISTA)
})

onBeforeUnmount(() => {
  clearInterval(reloj)
  conexionLobby?.cerrar()
  partida.value?.conexion.cerrar()
})

/* ------------------------------ Getting in ------------------------------ */

/** `solo`: create a room and play right away against 2 bots. `sala`: the code to join, from the list */
async function entrar(evento, { solo = false, sala = codigo.value } = {}) {
  error.value = ''
  if (!nombre.value.trim()) return (error.value = 'Escribe tu nombre')
  if (evento === EVENTOS.unirse && !String(sala).trim()) return (error.value = 'Escribe el código de la sala')
  guardar()
  conectando.value = true
  try {
    const conexion = await obtenerConexion()
    const r = await conexion.pedir(evento, {
      nombre: nombre.value,
      color: color.value,
      codigo: sala,
      circuito: mapa.value,
    })
    if (!r.ok) throw new Error(r.error)
    // This connection now belongs to the game
    conexionLobby = null
    conexion.alCerrarse(() => {
      salir()
      error.value = 'Se perdió la conexión con el servidor'
    })
    partida.value = { conexion, sala: r.sala, estado: r.partida, miId: r.id, solo }
  } catch (e) {
    error.value = e.message
  } finally {
    conectando.value = false
  }
}

/**
 * Modo local: this computer becomes the screen everybody looks at (no car of its own) and the
 * players join from their phones, which become the controllers
 */
async function crearPantalla() {
  error.value = ''
  guardar()
  conectando.value = true
  try {
    const conexion = await obtenerConexion()
    const r = await conexion.pedir(EVENTOS.pantalla, { circuito: mapa.value })
    if (!r.ok) throw new Error(r.error)
    conexionLobby = null
    conexion.alCerrarse(() => {
      salir()
      error.value = 'Se perdió la conexión con el servidor'
    })
    partida.value = { conexion, sala: r.sala, estado: r.partida, miId: r.id, solo: false }
  } catch (e) {
    error.value = e.message
  } finally {
    conectando.value = false
  }
}

function salir() {
  partida.value?.conexion.cerrar()
  partida.value = null
  refrescarSalas()
}

const textoFase = (fase) => (fase === 'espera' ? 'Esperando jugadores' : 'En partida · entras en la siguiente ronda')
</script>

<template>
  <JuegoEnLinea
    v-if="partida"
    :conexion="partida.conexion"
    :sala="partida.sala"
    :partida="partida.estado"
    :mi-id="partida.miId"
    :solo="partida.solo"
    :debug="route.query.debug !== undefined"
    @salir="salir"
  />

  <form v-else class="lobby card" @submit.prevent="entrar(EVENTOS.crear)">
    <div class="lobby__jugador">
      <div class="field">
        <label for="lobby-nombre">Tu nombre</label>
        <input
          id="lobby-nombre"
          v-model="nombre"
          class="input"
          :maxlength="LARGO_NOMBRE"
          autocomplete="nickname"
          placeholder="Como te verán los demás"
        />
      </div>

      <fieldset class="lobby__colores">
        <legend>Tu color</legend>
        <label v-for="c in COLORES" :key="c.id" class="lobby__color" :title="c.nombre">
          <input v-model="color" type="radio" name="color" :value="c.id" class="visually-hidden" />
          <span :style="{ background: c.color }"></span>
          <span class="visually-hidden">{{ c.nombre }}</span>
        </label>
      </fieldset>
    </div>

    <div class="lobby__opciones">
      <div class="lobby__opcion">
        <h3>Crea una sala</h3>
        <p class="muted">Te damos un código para que se unan hasta {{ MAX_JUGADORES - 1 }} amigos, o juega solo contra bots.</p>
        <fieldset class="lobby__mapas">
          <legend>Mapa</legend>
          <label v-for="m in MAPAS" :key="m.id" class="lobby__mapa">
            <input v-model="mapa" type="radio" name="mapa" :value="m.id" class="visually-hidden" />
            <span class="lobby__mapa-tarjeta">
              <img :src="miniMapa(m)" alt="" width="240" height="150" />
              <strong>{{ m.nombre }}</strong>
            </span>
          </label>
        </fieldset>
        <div class="lobby__crear">
          <button type="submit" class="btn" :disabled="conectando">Crear sala</button>
          <button type="button" class="btn btn--ghost" :disabled="conectando" @click="entrar(EVENTOS.crear, { solo: true })">
            Jugar contra 2 bots
          </button>
        </div>
      </div>

      <div class="lobby__opcion">
        <h3>Modo local</h3>
        <p class="muted">
          Todos ven esta pantalla y cada quien maneja con su celular: escanean el QR, ponen su nombre y listo. Hasta
          {{ MAX_JUGADORES }} jugadores.
        </p>
        <button type="button" class="btn btn--ghost" :disabled="conectando" @click="crearPantalla">
          Usar celulares como control
        </button>
      </div>

      <div class="lobby__opcion">
        <h3>Únete con un código</h3>
        <div class="lobby__unirse">
          <input
            v-model="codigo"
            class="input"
            placeholder="HMO-0000"
            aria-label="Código de la sala"
            autocomplete="off"
            @keydown.enter.prevent="entrar(EVENTOS.unirse)"
          />
          <button type="button" class="btn btn--ghost" :disabled="conectando" @click="entrar(EVENTOS.unirse)">
            Unirse
          </button>
        </div>
      </div>
    </div>

    <section class="lobby__salas" aria-labelledby="lobby-salas">
      <h3 id="lobby-salas">Salas abiertas</h3>
      <p v-if="salas === null" class="muted">Buscando salas…</p>
      <p v-else-if="!salas.length" class="muted">No hay salas abiertas ahorita. ¡Crea una y comparte el código!</p>
      <ul v-else class="lobby__lista">
        <li v-for="s in salas" :key="s.codigo">
          <span class="lobby__sala-codigo">{{ s.codigo }}</span>
          <span class="lobby__sala-info">
            <strong>Sala de {{ s.anfitrion }} · {{ nombreMapa(s.circuito) }}</strong>
            <span class="muted">
              {{ s.jugadores }}/{{ MAX_JUGADORES }} jugadores<template v-if="s.bots"> ({{ s.bots }} {{ s.bots === 1 ? 'bot' : 'bots' }})</template>
              · {{ textoFase(s.fase) }}
            </span>
          </span>
          <button
            type="button"
            class="btn btn--sm"
            :disabled="conectando"
            :aria-label="`Unirse a la sala ${s.codigo} de ${s.anfitrion}`"
            @click="entrar(EVENTOS.unirse, { sala: s.codigo })"
          >
            Unirse
          </button>
        </li>
      </ul>
    </section>

    <p v-if="conectando" class="lobby__aviso muted" role="status">Conectando…</p>
    <p v-else-if="error" class="lobby__aviso lobby__aviso--error" role="alert">{{ error }}</p>

    <div class="lobby__reglas">
      <h3>Cómo se juega</h3>
      <ol>
        <li>Una sola cámara para todos sigue al que va adelante.</li>
        <li>Si te quedas atrás y sales de la pantalla, caes a un barranco o te vas al mar, explotas.</li>
        <li>El último carro en pie gana la ronda. El primero en llegar a 5 puntos gana la partida.</li>
        <li>
          Cada color de caja da items de un tipo: de
          <template v-for="(g, k) in GRUPOS_CAJAS" :key="g.id">
            <span class="lobby__categoria" :style="{ '--color': g.color }">{{ g.nombre.toLowerCase() }}</span
            >{{ k < GRUPOS_CAJAS.length - 2 ? ', ' : k === GRUPOS_CAJAS.length - 2 ? ' y ' : '' }}
          </template>.
        </li>
      </ol>
      <p class="muted">
        <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> o <kbd>WASD</kbd> manejar · <kbd>Shift</kbd> o <kbd>E</kbd> usar
        item
      </p>
    </div>

    <details class="lobby__items">
      <summary>Los {{ ITEMS_CAJAS.length }} items de Hermosillo</summary>
      <section v-for="g in GRUPOS_CAJAS" :key="g.id" class="lobby__grupo">
        <h4><span class="lobby__caja" :style="{ background: g.color }">?</span> Cajas de {{ g.nombre.toLowerCase() }}</h4>
        <ul>
          <li v-for="item in g.items" :key="item.id">
            <img :src="iconoItem(item)" alt="" width="44" height="44" loading="lazy" />
            <span>
              <strong>{{ item.nombre }}</strong>
              <span class="muted">{{ item.descripcion }}</span>
            </span>
          </li>
        </ul>
      </section>
    </details>
  </form>
</template>

<style scoped>
.lobby__salas h3 {
  font-size: 1.5rem;
  margin: 0 0 8px;
}

.lobby__salas > p {
  margin: 0;
}

.lobby__lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.lobby__lista li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
}

.lobby__sala-codigo {
  font: 400 1.4rem var(--font-title);
  color: var(--accent-ink);
  white-space: nowrap;
}

.lobby__sala-info {
  flex: 1;
  min-width: 0;
  display: grid;
}

.lobby__sala-info strong,
.lobby__sala-info .muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lobby__sala-info .muted {
  font-size: 0.85rem;
}

.lobby__reglas {
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.lobby__reglas h3 {
  font-size: 1.5rem;
  margin: 0 0 6px;
}

.lobby__reglas ol {
  margin: 0 0 10px;
  padding-left: 1.2em;
  display: grid;
  gap: 4px;
}

.lobby__reglas p {
  margin: 0;
  font-size: 0.9rem;
}

.lobby kbd {
  display: inline-block;
  min-width: 1.6em;
  padding: 1px 6px;
  margin: 0 1px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 6px;
  font: 600 0.8rem var(--font-body);
  text-align: center;
}

.lobby__items summary {
  cursor: pointer;
  font-weight: 600;
}

.lobby__grupo h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 0;
  font: 400 1.3rem var(--font-title);
}

.lobby__caja {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 2px solid #22170f;
  border-radius: 6px;
  color: #22170f;
  font: 400 1.1rem var(--font-title);
}

.lobby__categoria {
  font-weight: 600;
  color: var(--color);
}

.lobby__items ul {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

@media (min-width: 720px) {
  .lobby__items ul {
    grid-template-columns: 1fr 1fr;
  }
}

.lobby__items li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.lobby__items img {
  flex: none;
  border-radius: 10px;
  background: #f1e6cc;
}

.lobby__items strong {
  display: block;
  font: 400 1.2rem / 1.1 var(--font-title);
}

.lobby__items .muted {
  font-size: 0.85rem;
}

.lobby {
  padding: 20px;
  display: grid;
  gap: 20px;
}

.lobby__jugador {
  display: grid;
  gap: 16px;
}

@media (min-width: 720px) {
  .lobby__jugador {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
  }
}

.lobby__colores {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 8px;
}

.lobby__colores legend {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 6px;
}

.lobby__color span:first-of-type {
  display: block;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid var(--surface);
  box-shadow: 0 0 0 2px var(--border);
  cursor: pointer;
}

.lobby__color input:checked + span {
  box-shadow: 0 0 0 3px var(--text);
}

.lobby__color input:focus-visible + span {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

.lobby__opciones {
  display: grid;
  gap: 20px;
}

@media (min-width: 720px) {
  .lobby__opciones {
    grid-template-columns: 1fr 1fr;
  }
}

.lobby__opcion h3 {
  font-size: 1.5rem;
  margin: 0 0 4px;
}

.lobby__opcion p {
  margin: 0 0 12px;
}

.lobby__mapas {
  border: 0;
  margin: 0 0 12px;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}

.lobby__mapas legend {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 6px;
}

.lobby__mapa-tarjeta {
  display: grid;
  gap: 4px;
  padding: 4px;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  cursor: pointer;
}

.lobby__mapa-tarjeta img {
  width: 100%;
  height: auto;
  border-radius: calc(var(--radius) - 4px);
}

.lobby__mapa-tarjeta strong {
  font: 400 1.1rem / 1.1 var(--font-title);
  text-align: center;
}

.lobby__mapa input:checked + .lobby__mapa-tarjeta {
  border-color: var(--text);
  box-shadow: 0 0 0 1px var(--text);
}

.lobby__mapa input:focus-visible + .lobby__mapa-tarjeta {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.lobby__crear {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.lobby__unirse {
  display: flex;
  gap: 8px;
}

.lobby__unirse .input {
  min-width: 0;
  flex: 1;
  text-transform: uppercase;
}

.lobby__aviso {
  margin: 0;
}

.lobby__aviso--error {
  color: var(--extremo);
  font-weight: 600;
}
</style>
