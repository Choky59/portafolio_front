<script setup>
defineProps({
  archivos: { type: Array, required: true },
})
</script>

<template>
  <div class="codigo">
    <article v-for="archivo in archivos" :key="archivo.titulo" class="codigo__archivo card">
      <header class="codigo__header">
        <strong>{{ archivo.titulo }}</strong>
        <span class="chip">{{ archivo.lenguaje }}</span>
        <a v-if="archivo.url" :href="archivo.url" target="_blank" rel="noopener" class="codigo__link">
          Ver completo ↗
        </a>
      </header>
      <pre v-if="archivo.contenido" class="codigo__pre"><code>{{ archivo.contenido }}</code></pre>
    </article>
  </div>
</template>

<style scoped>
.codigo {
  display: grid;
  gap: 14px;
}

.codigo__archivo {
  overflow: hidden;
}

.codigo__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
}

.codigo__link {
  margin-left: auto;
}

.codigo__pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  background: var(--bg);
  border-top: 1px solid var(--border);
  font-size: 0.85rem;
  line-height: 1.5;
}
</style>
