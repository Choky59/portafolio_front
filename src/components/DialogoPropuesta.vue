<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { config } from '../config'

// After 2 minutes on the site, invite the visitor to send a proposal by WhatsApp.
// Shown at most once per browser session, and never inside the admin panel.
const ESPERA_MS = 2 * 60 * 1000
const KEY = 'portafolio.dialogoPropuesta'

const route = useRoute()
const dialogo = ref(null)
let timer = null

function yaSeMostro() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function marcarMostrado() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // private mode: it may show again on the next visit, which is fine
  }
}

function abrir() {
  if (route.path.startsWith('/admin') || !dialogo.value) return
  marcarMostrado()
  dialogo.value.showModal()
}

function cerrar() {
  dialogo.value?.close()
}

// Clicking the backdrop (outside the card) closes the dialog
function clicFondo(e) {
  if (e.target === dialogo.value) cerrar()
}

onMounted(() => {
  if (config.whatsappPropuestaUrl && !yaSeMostro()) timer = setTimeout(abrir, ESPERA_MS)
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <dialog
    v-if="config.whatsappPropuestaUrl"
    ref="dialogo"
    class="dialogo"
    aria-labelledby="dialogo-titulo"
    @click="clicFondo"
  >
    <div class="dialogo__tarjeta">
      <button type="button" class="dialogo__cerrar" aria-label="Cerrar" @click="cerrar">×</button>
      <p class="dialogo__etiqueta">Disponible para nuevas oportunidades</p>
      <h2 id="dialogo-titulo">¿Te está gustando lo que ves?</h2>
      <p>Busco un equipo donde seguir desarrollando soluciones a problemas reales, del prototipo al producto.</p>
      <div class="dialogo__acciones">
        <a class="btn" :href="config.whatsappPropuestaUrl" target="_blank" rel="noopener" @click="cerrar">
          Contáctame por WhatsApp
        </a>
        <RouterLink class="btn btn--ghost" to="/sobre-mi" @click="cerrar">Conóceme</RouterLink>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.dialogo {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text);
  width: min(100% - 32px, 440px);
  max-width: none;
}

.dialogo::backdrop {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
}

.dialogo__tarjeta {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  padding: 28px 22px 22px;
}

.dialogo__tarjeta h2 {
  font-size: clamp(1.8rem, 6vw, 2.2rem);
  margin-top: 6px;
}

.dialogo__etiqueta {
  display: inline-block;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--on-accent);
  background: var(--accent);
  padding: 4px 12px;
  border-radius: 999px;
  margin: 0;
}

.dialogo__cerrar {
  position: absolute;
  top: 8px;
  right: 8px;
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

.dialogo__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
