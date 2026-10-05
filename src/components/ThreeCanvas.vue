<script setup>
/**
 * Mounts a Three.js scene (src/three/escenas/*) in a decorative canvas.
 * - Only runs while visible (IntersectionObserver); optionally frees the WebGL
 *   context when off screen (cards), since browsers allow ~16 contexts.
 * - prefers-reduced-motion: draws the finished frame once, no animation.
 * - Recreates the scene on theme change so it picks up the new palette.
 * - Shows the `poster` slot until the scene is ready, or if WebGL fails.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useVisible } from '../composables/useVisible'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useTheme } from '../composables/useTheme'

const props = defineProps({
  /** () => import('../three/escenas/x.js') */
  cargar: { type: Function, required: true },
  params: { type: Object, default: () => ({}) },
  /** User can drag (model viewer): keeps the loop running even with reduced motion */
  interactivo: { type: Boolean, default: false },
  /** Destroy the renderer when off screen instead of just pausing it */
  liberarFueraDePantalla: { type: Boolean, default: false },
})

const emit = defineEmits(['error'])

const wrapper = ref(null)
const lienzo = ref(null)
const listo = ref(false)
const fallo = ref(false)

const visible = useVisible(wrapper, { rootMargin: '150px' })
const reducido = useReducedMotion()
const { temaEfectivo } = useTheme()

let stage = null
let canvas = null
let creando = null
let desmontado = false

async function crear() {
  if (stage || fallo.value) return
  if (creando) return creando

  creando = (async () => {
    try {
      const [{ createStage }, escena] = await Promise.all([import('../three/stage.js'), props.cargar()])
      if (desmontado || !visible.value) return

      // A fresh canvas each time: a canvas whose context was lost can't be reused
      canvas = document.createElement('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      lienzo.value.appendChild(canvas)

      stage = createStage(canvas, escena.default, {
        params: props.params,
        reducedMotion: reducido.value,
      })
      listo.value = true
    } catch (err) {
      canvas?.remove()
      canvas = null
      fallo.value = true
      emit('error', err)
    } finally {
      creando = null
    }
  })()

  return creando
}

function liberar() {
  stage?.dispose()
  stage = null
  canvas?.remove()
  canvas = null
  listo.value = false
}

async function sincronizar() {
  if (desmontado) return

  if (visible.value) {
    await crear()
    if (!stage || !visible.value) return
    if (reducido.value && !props.interactivo) {
      stage.stop()
      stage.renderOnce()
    } else {
      stage.start()
    }
  } else if (stage) {
    if (props.liberarFueraDePantalla) liberar()
    else stage.stop()
  }
}

watch([visible, reducido], sincronizar)

watch(temaEfectivo, () => {
  if (!stage) return
  liberar()
  sincronizar()
})

watch(
  () => props.params,
  (params) => stage?.setParams(params),
  { deep: true }
)

/* Pointer + scroll → scene input */
function onPointer(e) {
  stage?.setInput({
    x: (e.clientX / window.innerWidth) * 2 - 1,
    y: -((e.clientY / window.innerHeight) * 2 - 1),
  })
}

function onScroll() {
  if (!stage || !wrapper.value) return
  const rect = wrapper.value.getBoundingClientRect()
  const progreso = Math.min(1, Math.max(0, -rect.top / (rect.height || 1)))
  stage.setInput({ scroll: progreso })
}

onMounted(() => {
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  desmontado = true
  window.removeEventListener('pointermove', onPointer)
  window.removeEventListener('scroll', onScroll)
  liberar()
})
</script>

<template>
  <div ref="wrapper" class="three" :class="{ 'three--interactivo': interactivo }">
    <div v-if="!listo" class="three__poster" aria-hidden="true">
      <slot name="poster" />
    </div>
    <div ref="lienzo" class="three__lienzo" :class="{ 'three__lienzo--listo': listo }" />
  </div>
</template>

<style scoped>
.three {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.three__poster,
.three__lienzo {
  position: absolute;
  inset: 0;
}

.three__lienzo {
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
}

.three__lienzo--listo {
  opacity: 1;
}

.three--interactivo .three__lienzo {
  pointer-events: auto;
  cursor: grab;
}

.three__lienzo :deep(canvas) {
  width: 100%;
  height: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .three__lienzo {
    transition: none;
  }
}
</style>
