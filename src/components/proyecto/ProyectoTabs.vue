<script setup>
/**
 * Sticky tab bar of a project page. Each tab is a real route (shareable, Back works).
 * On phones it scrolls sideways and keeps the active tab centered.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { pestanasDe } from '../../composables/useProyecto'

const props = defineProps({
  proyecto: { type: Object, required: true },
})

const route = useRoute()
const lista = ref(null)

const pestanas = computed(() => pestanasDe(props.proyecto))
const activa = (p) => p.rutas.includes(route.name)

async function centrarActiva() {
  await nextTick()
  const contenedor = lista.value
  const el = contenedor?.querySelector('[aria-current="page"]')
  if (!contenedor || !el) return
  const destino = el.offsetLeft - (contenedor.clientWidth - el.clientWidth) / 2
  contenedor.scrollTo({ left: Math.max(0, destino), behavior: 'smooth' })
}

onMounted(centrarActiva)
watch(() => route.name, centrarActiva)
</script>

<template>
  <nav class="tabs" aria-label="Secciones del proyecto">
    <div ref="lista" class="tabs__lista container">
      <RouterLink
        v-for="p in pestanas"
        :key="p.ruta"
        :to="{ name: p.ruta, params: { slug: proyecto.slug } }"
        class="tabs__tab"
        :class="{ 'tabs__tab--activa': activa(p) }"
        :aria-current="activa(p) ? 'page' : undefined"
      >
        {{ p.nombre }}
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.tabs {
  position: sticky;
  top: 60px; /* below the fixed top bar */
  z-index: 40;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.tabs__lista {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs__lista::-webkit-scrollbar {
  display: none;
}

.tabs__tab {
  flex: 0 0 auto;
  padding: 12px 14px;
  font-weight: 600;
  color: var(--muted);
  text-decoration: none;
  border-bottom: 3px solid transparent;
  white-space: nowrap;
}

.tabs__tab:hover {
  color: var(--text);
}

.tabs__tab--activa {
  color: var(--text);
  border-bottom-color: var(--accent);
}
</style>
