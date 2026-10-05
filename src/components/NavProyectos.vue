<script setup>
defineProps({
  anterior: { type: Object, default: null },
  siguiente: { type: Object, default: null },
})
</script>

<template>
  <nav v-if="anterior || siguiente" class="nav-proyectos" aria-label="Otros proyectos">
    <RouterLink v-if="anterior" :to="`/proyectos/${anterior.slug}`" class="nav-proyectos__link card">
      <span class="muted">← Proyecto #{{ anterior.numero }}</span>
      <strong>{{ anterior.titulo }}</strong>
    </RouterLink>
    <span v-else />

    <RouterLink
      v-if="siguiente"
      :to="`/proyectos/${siguiente.slug}`"
      class="nav-proyectos__link nav-proyectos__link--siguiente card"
    >
      <span class="muted">Proyecto #{{ siguiente.numero }} →</span>
      <strong>{{ siguiente.titulo }}</strong>
    </RouterLink>
  </nav>
</template>

<style scoped>
.nav-proyectos {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .nav-proyectos {
    grid-template-columns: 1fr 1fr;
  }
}

.nav-proyectos__link {
  display: grid;
  gap: 4px;
  padding: 18px;
  color: var(--text);
  text-decoration: none;
}

.nav-proyectos__link--siguiente {
  text-align: right;
}

.nav-proyectos__link strong {
  font-family: var(--font-title);
  font-weight: 400;
  font-size: 1.5rem;
}
</style>
