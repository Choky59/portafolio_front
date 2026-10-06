<script setup>
/**
 * Shell for every /admin section: title, session, logout and the section menu.
 * To add a section (e.g. Archivos): add a child route in router/index.js and an entry here.
 */
import { useRouter } from 'vue-router'
import { useSession } from '../../composables/useSession'

const router = useRouter()
const { usuario, cerrar } = useSession()

const secciones = [
  { nombre: 'Inicio', ruta: { name: 'admin-inicio' } },
  { nombre: 'Sensores', ruta: { name: 'admin-sensores' } },
  { nombre: 'Archivos', ruta: { name: 'admin-archivos' } },
]

async function salir() {
  await cerrar()
  router.replace('/admin/login')
}
</script>

<template>
  <div class="admin container">
    <header class="admin__header">
      <div>
        <h1 class="admin__titulo">Panel</h1>
        <p class="muted">Sesión de {{ usuario?.displayName ?? usuario?.username }}</p>
      </div>
      <button type="button" class="btn btn--ghost btn--sm" @click="salir">Cerrar sesión</button>
    </header>

    <nav class="admin__nav" aria-label="Secciones del panel">
      <RouterLink v-for="s in secciones" :key="s.nombre" :to="s.ruta" class="admin__tab">
        {{ s.nombre }}
      </RouterLink>
    </nav>

    <RouterView />
  </div>
</template>

<style scoped>
.admin {
  padding-top: 90px;
  padding-bottom: 80px;
}

.admin__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.admin__titulo {
  font-size: clamp(2.2rem, 7vw, 3rem);
}

.admin__nav {
  display: flex;
  gap: 6px;
  margin: 8px 0 24px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.admin__tab {
  padding: 10px 16px;
  font-weight: 600;
  color: var(--muted);
  text-decoration: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
  white-space: nowrap;
}

.admin__tab.router-link-active {
  color: var(--text);
  border-bottom-color: var(--accent);
}
</style>
