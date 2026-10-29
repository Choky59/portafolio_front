<script setup>
import { computed } from 'vue'

/** End of the match: ranking by points, and "play again" for the host */
const props = defineProps({
  partida: { type: Object, required: true },
  /** id → { nombre, color } */
  jugadores: { type: Object, required: true },
  esAnfitrion: { type: Boolean, default: false },
  anfitrion: { type: String, default: '' },
  error: { type: String, default: '' },
})
const emit = defineEmits(['otra-vez', 'salir'])

const ranking = computed(() =>
  [...props.partida.puntos]
    .filter((p) => props.jugadores[p.id])
    .sort((a, b) => b.puntos - a.puntos)
    .map((p) => ({ ...p, ...props.jugadores[p.id] })),
)
const ganador = computed(() => props.jugadores[props.partida.ganador])
</script>

<template>
  <div class="resultados" role="dialog" aria-labelledby="resultados-titulo">
    <div class="resultados__tarjeta card">
      <p class="resultados__antetitulo muted">Primero en llegar a {{ partida.meta }}</p>
      <h3 id="resultados-titulo" class="resultados__titulo">
        <template v-if="ganador">¡Ganó <span :style="{ color: ganador.color }">{{ ganador.nombre }}</span>!</template>
        <template v-else>Fin de la partida</template>
      </h3>
      <ol class="resultados__lista">
        <li v-for="(p, i) in ranking" :key="p.id">
          <span class="resultados__lugar">{{ i + 1 }}</span>
          <span class="resultados__color" :style="{ background: p.color }"></span>
          <span class="resultados__nombre">{{ p.nombre }}</span>
          <span class="resultados__puntos">{{ p.puntos }}</span>
        </li>
      </ol>
      <p v-if="error" class="resultados__error" role="alert">{{ error }}</p>
      <div class="resultados__acciones">
        <button v-if="esAnfitrion" type="button" class="btn" @click="emit('otra-vez')">Jugar otra vez</button>
        <p v-else class="muted">Esperando a que {{ jugadores[anfitrion]?.nombre ?? 'quien creó la sala' }} empiece otra…</p>
        <button type="button" class="btn btn--ghost btn--sm" @click="emit('salir')">Salir de la sala</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resultados {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(34, 23, 15, 0.55);
}

.resultados__tarjeta {
  width: min(360px, 100%);
  padding: 20px;
  text-align: center;
  max-height: 100%;
  overflow: auto;
}

.resultados__antetitulo {
  margin: 0;
  font-size: 0.85rem;
}

.resultados__titulo {
  margin: 2px 0 12px;
  font-size: clamp(1.8rem, 5vw, 2.4rem);
}

.resultados__lista {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: grid;
  gap: 6px;
  text-align: left;
}

.resultados__lista li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.resultados__lugar {
  width: 1.5em;
  font-family: var(--font-title);
  font-size: 1.3rem;
  color: var(--muted);
}

.resultados__color {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--text);
  flex: none;
}

.resultados__nombre {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resultados__puntos {
  font-family: var(--font-title);
  font-size: 1.4rem;
}

.resultados__acciones {
  display: grid;
  gap: 8px;
  justify-items: center;
}

.resultados__acciones p {
  margin: 0;
}

.resultados__error {
  color: var(--extremo);
  font-weight: 600;
}
</style>
