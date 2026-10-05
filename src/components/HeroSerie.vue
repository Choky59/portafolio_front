<script setup>
import ThreeCanvas from './ThreeCanvas.vue'
import { config } from '../config'

const cargarDesierto = () => import('../three/escenas/desierto.js')
</script>

<template>
  <header class="hero">
    <div class="hero__escena">
      <ThreeCanvas :cargar="cargarDesierto">
        <template #poster>
          <div class="hero__poster" />
        </template>
      </ThreeCanvas>
    </div>

    <div class="hero__contenido container">
      <p class="hero__serie">{{ config.serie }}</p>
      <h1 class="hero__nombre">{{ config.nombre }}</h1>
      <p class="hero__presentacion">{{ config.presentacion }}</p>

      <div class="hero__acciones">
        <a v-if="config.cvUrl" class="btn" :href="config.cvUrl" target="_blank" rel="noopener">
          Ver mi CV
        </a>
        <a
          v-if="config.whatsappUrl"
          class="btn btn--ghost"
          :href="config.whatsappUrl"
          target="_blank"
          rel="noopener"
        >
          Escríbeme por WhatsApp
        </a>
        <a class="btn btn--ghost" href="#proyectos">Ver proyectos ↓</a>
      </div>
    </div>
  </header>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: min(88vh, 760px);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.hero__escena {
  position: absolute;
  inset: 0;
}

/* Keeps the text readable over the 3D scene */
.hero__escena::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--bg) 8%, color-mix(in srgb, var(--bg) 55%, transparent) 55%, transparent);
  pointer-events: none;
}

.hero__poster {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 75% 25%, var(--accent) 0 9%, transparent 10%),
    linear-gradient(to bottom, var(--surface), var(--three-suelo));
}

.hero__contenido {
  position: relative;
  padding-top: 120px;
  padding-bottom: 48px;
}

.hero__serie {
  display: inline-block;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--on-accent);
  background: var(--accent);
  padding: 4px 12px;
  border-radius: 999px;
}

.hero__nombre {
  margin-top: 12px;
}

.hero__presentacion {
  max-width: 36rem;
  font-size: 1.15rem;
}

.hero__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
</style>
