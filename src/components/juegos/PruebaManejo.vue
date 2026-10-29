<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, shallowRef, toRaw } from 'vue'
import { useRoute } from 'vue-router'
import { PARAMETROS_FISICA } from '../../juego/compartido/fisica'
import { crearJuegoLocal } from '../../juego/local.js'
import LienzoJuego from './LienzoJuego.vue'
import PanelFisica from './PanelFisica.vue'
import PanelSonido from './PanelSonido.vue'
import TeclasJuego from './TeclasJuego.vue'

/** Phase 1 bench: one car on the test circuit, no server, with the physics panel beside it */
const props = defineProps({
  // On a content page the game waits for a click instead of grabbing the keyboard (and the scroll)
  enfocarAlInicio: { type: Boolean, default: false },
})

// ?circuito=hermosillo&s=450 picks the circuit and where on the lap to start
const circuitos = Object.fromEntries(
  Object.values(import.meta.glob('../../juego/datos/circuitos/*.json', { eager: true, import: 'default' })).map((c) => [c.id, c]),
)
const route = useRoute()
const circuito = circuitos[route.query.circuito] ?? circuitos.prueba
const inicio = Number(route.query.s) || 0

const iniciales = structuredClone(PARAMETROS_FISICA)
const params = reactive(structuredClone(PARAMETROS_FISICA))

const vista = ref(null)
const hud = ref({ kmh: 0, suelo: 'asfalto', derrape: 0 })
let juego = null
const sonido = shallowRef(null)

onMounted(() => {
  // The game reads the raw object every tick; the panel writes through the reactive proxy
  juego = crearJuegoLocal(vista.value.lienzo, {
    circuito,
    inicio,
    params: toRaw(params),
    alEstado: (e) => (hud.value = e),
  })
  sonido.value = juego.sonido
  if (props.enfocarAlInicio) vista.value.enfocar()
})

onBeforeUnmount(() => juego?.destruir())

function tecla(e) {
  // Browsers only start audio after a gesture: the first key does it
  juego?.sonido.activar()
  if (e.code !== 'KeyR') return
  juego?.reiniciar()
}
</script>

<template>
  <div class="manejo">
    <LienzoJuego ref="vista" :hud="hud" @tecla="tecla" />
    <div class="manejo__paneles">
      <PanelFisica :params="params" :iniciales="iniciales" />
      <div class="manejo__sonido card">
        <h2 class="manejo__titulo">Sonido</h2>
        <PanelSonido :sonido="sonido" @listo="vista?.enfocar()" />
      </div>
    </div>
    <TeclasJuego class="manejo__ayuda" reiniciar />
  </div>
</template>

<style scoped>
.manejo {
  display: grid;
  gap: 16px;
}

.manejo__paneles {
  display: grid;
  gap: 16px;
  align-content: start;
}

.manejo__sonido {
  padding: 16px;
}

.manejo__titulo {
  font-size: 1.6rem;
  margin: 0 0 8px;
}

@media (min-width: 960px) {
  .manejo {
    grid-template-columns: minmax(0, 1fr) 300px;
  }

  .manejo__ayuda {
    grid-column: 1;
  }
}
</style>
