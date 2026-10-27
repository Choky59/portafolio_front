<script setup>
/**
 * Full-screen modal of a news of the crowd ("Ver más"): the same card as Análisis ›
 * Noticias, with the full analysis already open (GET /pulso/notas/:id). The fictional
 * examples aren't in the API, so they show only what the crowd has.
 * A chip or a person in the card opens Análisis › Noticias with that filter.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import EstadoCarga from '../EstadoCarga.vue'
import EstadoError from '../EstadoError.vue'
import NotaTarjeta from '../analisis/pulso/NotaTarjeta.vue'
import { getNota } from '../../api/pulso'
import { iconoFuente } from '../../three/pulso/emociones'

const props = defineProps({
  /** The news in the crowd's shape (usePulso) */
  noticia: { type: Object, required: true },
  esDemo: { type: Boolean, default: false },
})
const emit = defineEmits(['cerrar'])

const router = useRouter()
const dialogo = ref(null)
const nota = ref(null)
const error = ref(null)
const cargando = ref(false)
let control = null

async function cargar() {
  control?.abort()
  nota.value = null
  error.value = null
  if (props.esDemo) return
  control = new AbortController()
  cargando.value = true
  try {
    nota.value = (await getNota(props.noticia.id, control.signal)).nota
  } catch (err) {
    if (err?.name !== 'AbortError') error.value = err
  } finally {
    cargando.value = false
  }
}

watch(() => props.noticia.id, cargar, { immediate: true })

onMounted(() => dialogo.value?.showModal())

function cerrar() {
  control?.abort()
  dialogo.value?.close()
}

// Clicking the backdrop (outside the card) closes it; Esc closes it too (the dialog's own 'close')
function clicFondo(e) {
  if (e.target === dialogo.value) cerrar()
}

function filtrar(filtros) {
  cerrar()
  router.push({ name: 'proyecto-analisis', params: { slug: 'pulso-hermosillo' }, query: { vista: 'noticias', ...filtros } })
}

const fecha = computed(() =>
  props.noticia.fecha
    ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Hermosillo' }).format(
        new Date(props.noticia.fecha)
      )
    : ''
)
</script>

<template>
  <dialog ref="dialogo" class="modal" aria-labelledby="modal-noticia-titulo" @click="clicFondo" @close="emit('cerrar')">
    <div class="modal__caja">
      <header class="modal__cabeza">
        <p id="modal-noticia-titulo" class="modal__fuente">
          <span aria-hidden="true">{{ iconoFuente(noticia.fuente?.tipo) }}</span> {{ noticia.fuente?.nombre }}
        </p>
        <button type="button" class="modal__cerrar" aria-label="Cerrar noticia" @click="cerrar">×</button>
      </header>

      <div class="modal__cuerpo">
        <EstadoCarga v-if="cargando" texto="Cargando el análisis…" />
        <EstadoError v-else-if="error" :error="error" titulo="No se pudo cargar el análisis" @reintentar="cargar" />
        <NotaTarjeta v-else-if="nota" :nota="nota" :nombre-fuente="noticia.fuente?.nombre ?? ''" abierto @filtrar="filtrar" />

        <!-- Fictional example: only what the crowd has -->
        <article v-else class="demo card">
          <p class="muted">Noticia de ejemplo (ficticia){{ fecha ? ` · ${fecha}` : '' }}</p>
          <h3>{{ noticia.titulo }}</h3>
          <p>{{ noticia.resumen }}</p>
        </article>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text);
  width: min(100% - 24px, 820px);
  max-width: none;
  height: min(100% - 24px, 900px);
  max-height: none;
}

.modal::backdrop {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
}

.modal__caja {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.modal__cabeza {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 6px 6px 18px;
  border-bottom: 1px solid var(--border);
}

.modal__fuente {
  margin: 0;
  font-weight: 700;
}

.modal__cerrar {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
}

.modal__cuerpo {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Phones: the whole screen */
@media (max-width: 600px) {
  .modal {
    width: 100%;
    height: 100%;
  }

  .modal__caja {
    border-radius: 0;
    border: none;
  }
}

.demo {
  padding: 16px;
}
</style>
