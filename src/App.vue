<script setup>
import { useTheme } from './composables/useTheme'
import { config } from './config'
import DialogoPropuesta from './components/DialogoPropuesta.vue'

const { temaEfectivo, alternar } = useTheme()
const anio = new Date().getFullYear()
</script>

<template>
  <a class="skip-link" href="#contenido">Saltar al contenido</a>

  <nav class="barra" aria-label="Principal">
    <div class="barra__interior container">
      <RouterLink to="/" class="barra__marca">{{ config.nombre }}</RouterLink>
      <div class="barra__acciones">
        <RouterLink to="/#proyectos" class="barra__link">Proyectos</RouterLink>
        <RouterLink to="/sobre-mi" class="barra__link">Sobre mí</RouterLink>
        <button
          type="button"
          class="barra__tema"
          :aria-label="temaEfectivo === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          @click="alternar"
        >
          <span aria-hidden="true">{{ temaEfectivo === 'dark' ? '☀️' : '🌙' }}</span>
        </button>
      </div>
    </div>
  </nav>

  <main id="contenido">
    <RouterView />
  </main>

  <footer class="pie">
    <div class="pie__interior container">
      <p>
        <strong>{{ config.nombre }}</strong> · Hermosillo, Sonora<br />
        <span class="muted">{{ config.serie }}.</span>
      </p>
      <p class="pie__links">
        <RouterLink to="/sobre-mi">Sobre mí</RouterLink>
        <a v-if="config.cvUrl" :href="config.cvUrl" target="_blank" rel="noopener">CV</a>
        <a v-if="config.whatsappUrl" :href="config.whatsappUrl" target="_blank" rel="noopener">WhatsApp</a>
        <span class="muted">© {{ anio }}</span>
      </p>
    </div>
  </footer>

  <DialogoPropuesta />
</template>

<style scoped>
.barra {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.barra__interior {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
}

.barra__marca {
  font-family: var(--font-title);
  font-size: 1.6rem;
  color: var(--text);
  text-decoration: none;
}

.barra__acciones {
  display: flex;
  align-items: center;
  gap: 8px;
}

.barra__link {
  color: var(--text);
  font-weight: 600;
  text-decoration: none;
  padding: 8px 10px;
}

/* Small phones: brand + two links + theme button must fit in one row */
@media (max-width: 420px) {
  .barra__marca {
    font-size: 1.35rem;
  }

  .barra__acciones {
    gap: 2px;
  }

  .barra__link {
    padding: 8px 6px;
    font-size: 0.92rem;
  }
}

.barra__tema {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: transparent;
  font-size: 1.1rem;
  cursor: pointer;
}

.pie {
  border-top: 1px solid var(--border);
  padding: 28px 0;
}

.pie__interior {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
}

.pie__interior p {
  margin: 0;
}

.pie__links {
  display: flex;
  gap: 16px;
  align-items: center;
}
</style>
