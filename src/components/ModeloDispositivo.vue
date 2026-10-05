<script setup>
import { ref } from 'vue'
import ThreeCanvas from './ThreeCanvas.vue'

const props = defineProps({
  src: { type: String, required: true },
  poster: { type: String, default: '' },
  titulo: { type: String, default: 'Modelo 3D del dispositivo' },
})

const estado = ref('cargando')
const cargar = () => import('../three/escenas/modelo.js')

// Not reactive on purpose: the viewer loads the model once per mount
const params = { src: props.src, onEstado: (e) => (estado.value = e) }
</script>

<template>
  <figure class="modelo">
    <div class="modelo__visor card">
      <ThreeCanvas :cargar="cargar" :params="params" interactivo @error="estado = 'error'">
        <template #poster>
          <img v-if="poster" :src="poster" alt="" class="modelo__poster" />
        </template>
      </ThreeCanvas>
      <p v-if="estado === 'cargando'" class="modelo__aviso muted" role="status">Cargando modelo…</p>
      <p v-else-if="estado === 'error'" class="modelo__aviso muted" role="alert">
        No se pudo cargar el modelo 3D.
      </p>
    </div>
    <figcaption>
      {{ titulo }} <span class="muted">· Arrastra para girarlo, pellizca o usa la rueda para acercar.</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.modelo {
  margin: 0;
}

.modelo__visor {
  position: relative;
  height: min(70vh, 460px);
  overflow: hidden;
}

.modelo__poster {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.modelo__aviso {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  text-align: center;
  margin: 0;
  pointer-events: none;
}

figcaption {
  margin-top: 8px;
}
</style>
