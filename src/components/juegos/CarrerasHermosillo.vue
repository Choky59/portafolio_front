<script setup>
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { COLORES, EVENTOS, LARGO_NOMBRE, MAX_JUGADORES } from '../../juego/compartido/protocolo'
import { crearConexion } from '../../juego/red/conexion.js'
import { iconoItem } from '../../juego/render/iconos.js'
import ITEMS from '../../juego/datos/items.json'
import JuegoEnLinea from './JuegoEnLinea.vue'

/**
 * Proyecto #3's game: pick a name and a color, then create a room (and share its code)
 * or join one with a code. Name and color are remembered in this browser.
 */
const GUARDADO = 'carreras:jugador'
const route = useRoute()

const guardado = leerGuardado()
const nombre = ref(guardado.nombre ?? '')
const color = ref(COLORES.some((c) => c.id === guardado.color) ? guardado.color : COLORES[0].id)
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
    localStorage.setItem(GUARDADO, JSON.stringify({ nombre: nombre.value.trim(), color: color.value }))
  } catch {
    // Private mode: nothing to remember
  }
}

/** `solo`: create a room and play right away against 2 bots */
async function entrar(evento, { solo = false } = {}) {
  error.value = ''
  if (!nombre.value.trim()) return (error.value = 'Escribe tu nombre')
  if (evento === EVENTOS.unirse && !codigo.value.trim()) return (error.value = 'Escribe el código de la sala')
  guardar()
  conectando.value = true
  // ?lag=150&jitter=40 simulates a far-away server (ms, round trip + random variation)
  const conexion = crearConexion({ lag: Number(route.query.lag) || 0, jitter: Number(route.query.jitter) || 0 })
  try {
    await conexion.abierta()
    const r = await conexion.pedir(evento, { nombre: nombre.value, color: color.value, codigo: codigo.value })
    if (!r.ok) throw new Error(r.error)
    conexion.alCerrarse(() => {
      salir()
      error.value = 'Se perdió la conexión con el servidor'
    })
    partida.value = { conexion, sala: r.sala, estado: r.partida, miId: r.id, solo }
  } catch (e) {
    conexion.cerrar()
    error.value = e.message
  } finally {
    conectando.value = false
  }
}

function salir() {
  partida.value?.conexion.cerrar()
  partida.value = null
}

onBeforeUnmount(() => partida.value?.conexion.cerrar())
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
        <div class="lobby__crear">
          <button type="submit" class="btn" :disabled="conectando">Crear sala</button>
          <button type="button" class="btn btn--ghost" :disabled="conectando" @click="entrar(EVENTOS.crear, { solo: true })">
            Jugar contra 2 bots
          </button>
        </div>
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

    <p v-if="conectando" class="lobby__aviso muted" role="status">Conectando…</p>
    <p v-else-if="error" class="lobby__aviso lobby__aviso--error" role="alert">{{ error }}</p>

    <div class="lobby__reglas">
      <h3>Cómo se juega</h3>
      <ol>
        <li>Una sola cámara para todos sigue al que va adelante.</li>
        <li>Si te quedas atrás y sales de la pantalla, o caes a un barranco del Cerro, explotas.</li>
        <li>El último carro en pie gana la ronda. El primero en llegar a 5 puntos gana la partida.</li>
      </ol>
      <p class="muted">
        <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> o <kbd>WASD</kbd> manejar · <kbd>Espacio</kbd> freno de mano ·
        <kbd>Shift</kbd> o <kbd>E</kbd> usar item
      </p>
    </div>

    <details class="lobby__items">
      <summary>Los {{ ITEMS.length }} items de Hermosillo</summary>
      <ul>
        <li v-for="item in ITEMS" :key="item.id">
          <img :src="iconoItem(item)" alt="" width="44" height="44" loading="lazy" />
          <span>
            <strong>{{ item.nombre }}</strong>
            <span class="muted">{{ item.descripcion }}</span>
          </span>
        </li>
      </ul>
    </details>
  </form>
</template>

<style scoped>
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
