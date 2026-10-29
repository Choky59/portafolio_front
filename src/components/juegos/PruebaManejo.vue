<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, toRaw } from 'vue'
import circuito from '../../juego/datos/circuitos/prueba.json'
import { PARAMETROS_FISICA } from '../../juego/compartido/fisica'
import { crearJuegoLocal } from '../../juego/local.js'
import LienzoJuego from './LienzoJuego.vue'
import PanelFisica from './PanelFisica.vue'
import TeclasJuego from './TeclasJuego.vue'

/** Phase 1 bench: one car on the test circuit, no server, with the physics panel beside it */
const props = defineProps({
  // On a content page the game waits for a click instead of grabbing the keyboard (and the scroll)
  enfocarAlInicio: { type: Boolean, default: false },
})

const iniciales = structuredClone(PARAMETROS_FISICA)
const params = reactive(structuredClone(PARAMETROS_FISICA))

const vista = ref(null)
const hud = ref({ kmh: 0, suelo: 'asfalto', derrape: 0 })
let juego = null

onMounted(() => {
  // The game reads the raw object every tick; the panel writes through the reactive proxy
  juego = crearJuegoLocal(vista.value.lienzo, { circuito, params: toRaw(params), alEstado: (e) => (hud.value = e) })
  if (props.enfocarAlInicio) vista.value.enfocar()
})

onBeforeUnmount(() => juego?.destruir())

function tecla(e) {
  if (e.code !== 'KeyR') return
  juego?.reiniciar()
}
</script>

<template>
  <div class="manejo">
    <LienzoJuego ref="vista" :hud="hud" @tecla="tecla" />
    <PanelFisica :params="params" :iniciales="iniciales" />
    <TeclasJuego class="manejo__ayuda" reiniciar />
  </div>
</template>

<style scoped>
.manejo {
  display: grid;
  gap: 16px;
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
