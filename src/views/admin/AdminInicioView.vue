<script setup>
const secciones = [
  {
    nombre: 'Sensores',
    descripcion: 'Registra y vincula sensores ESP32, asígnales un proyecto, revócalos o bórralos.',
    icono: '📡',
    ruta: { name: 'admin-sensores' },
  },
  {
    nombre: 'Archivos',
    descripcion: 'Sube los videos y modelos 3D de los proyectos a Firebase Storage.',
    icono: '🎞️',
    ruta: { name: 'admin-archivos' },
  },
]
</script>

<template>
  <section>
    <h2 class="visually-hidden">Secciones</h2>
    <ul class="secciones">
      <li v-for="s in secciones" :key="s.nombre">
        <RouterLink :to="s.ruta" class="seccion card">
          <span class="seccion__icono" aria-hidden="true">{{ s.icono }}</span>
          <span class="seccion__nombre">{{ s.nombre }}</span>
          <span class="seccion__descripcion muted">{{ s.descripcion }}</span>
          <span class="seccion__ir" aria-hidden="true">Entrar →</span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.secciones {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 16px;
}

@media (min-width: 720px) {
  .secciones {
    grid-template-columns: repeat(2, 1fr);
  }
}

.seccion {
  display: grid;
  gap: 6px;
  height: 100%;
  padding: 24px;
  color: var(--text);
  text-decoration: none;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.seccion:hover,
.seccion:focus-visible {
  transform: translateY(-2px);
  border-color: var(--accent);
}

.seccion__icono {
  font-size: 2rem;
}

.seccion__nombre {
  font-family: var(--font-title);
  font-size: 2rem;
  line-height: 1.1;
}

.seccion__ir {
  margin-top: 8px;
  font-weight: 600;
  color: var(--accent-ink);
}

@media (prefers-reduced-motion: reduce) {
  .seccion,
  .seccion:hover {
    transition: none;
    transform: none;
  }
}
</style>
