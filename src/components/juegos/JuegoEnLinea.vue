<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { crearJuegoEnLinea } from '../../juego/enLinea.js'
import { MAX_JUGADORES } from '../../juego/compartido/protocolo'
import { colorCarro } from '../../juego/render/colores.js'
import LienzoJuego from './LienzoJuego.vue'
import TeclasJuego from './TeclasJuego.vue'

/** A room in play: the 3D view, the code to share and who's in */
const props = defineProps({
  conexion: { type: Object, required: true },
  sala: { type: Object, required: true },
  miId: { type: String, required: true },
  debug: { type: Boolean, default: false },
})
const emit = defineEmits(['salir'])

const vista = ref(null)
const hud = ref({ kmh: 0, suelo: 'asfalto', derrape: 0, ping: null })
const salaActual = ref(props.sala)
const copiado = ref(false)
let juego = null

onMounted(() => {
  juego = crearJuegoEnLinea(vista.value.lienzo, {
    conexion: props.conexion,
    sala: props.sala,
    miId: props.miId,
    alEstado: (e) => (hud.value = e),
    alCambiarSala: (s) => (salaActual.value = s),
    debug: props.debug,
  })
  vista.value.enfocar()
})

onBeforeUnmount(() => juego?.destruir())

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
    <LienzoJuego ref="vista" :hud="hud" :debug="debug" />

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
          <span v-if="j.id === salaActual.anfitrion" class="en-linea__anfitrion" title="Creó la sala">★</span>
        </li>
      </ul>

      <button type="button" class="btn btn--sm btn--ghost" @click="emit('salir')">Salir de la sala</button>
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
</style>
