<script setup>
/**
 * STATUS: every Edge Racers match the server simulates (live and the last ones), with each real
 * player's device and the diagnosis of where their lag comes from (render, network, prediction).
 * A click opens the match, every player side by side (PartidaJuegoView). Refreshes every 3 s
 * while the tab is visible.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getEstadoJuego } from '../../api/admin'
import { mensajeError } from '../../api/client'
import { NOMBRES_BANDERA, colorJugador, duracion, iconoDispositivo, peorNivel, textoDispositivo } from './juego.util'

const CADA_MS = 3000

const datos = ref(null)
const error = ref(null)
const actualizado = ref(null)
let reloj = null
let pedido = null

async function cargar() {
  if (document.hidden) return
  pedido?.abort()
  pedido = new AbortController()
  try {
    datos.value = await getEstadoJuego(pedido.signal)
    error.value = null
    actualizado.value = new Date()
  } catch (err) {
    if (err?.name !== 'AbortError') error.value = err
  }
}

const alCambiarVisibilidad = () => !document.hidden && cargar()

onMounted(() => {
  cargar()
  reloj = setInterval(cargar, CADA_MS)
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
})

onBeforeUnmount(() => {
  clearInterval(reloj)
  pedido?.abort()
  document.removeEventListener('visibilitychange', alCambiarVisibilidad)
})

const servidor = computed(() => datos.value?.servidor ?? null)
const partidas = computed(() => datos.value?.partidas ?? [])
const enCurso = computed(() => partidas.value.filter((p) => p.fin === null))
const terminadas = computed(() => partidas.value.filter((p) => p.fin !== null))

/** The flags of a player: live (last 30 s) while the match runs, the whole match once it's over */
const banderasDe = (p, j) => (p.fin === null ? j.banderasAhora : j.banderas) ?? []

function uptime(s) {
  return duracion(0, s * 1000)
}
</script>

<template>
  <section class="estado-juego">
    <div class="estado-juego__cabecera">
      <h2 class="estado-juego__titulo">Status · Edge Racers</h2>
      <p class="muted">
        <template v-if="actualizado">Actualizado {{ actualizado.toLocaleTimeString() }} · cada {{ CADA_MS / 1000 }} s</template>
        <template v-else>Cargando…</template>
      </p>
    </div>

    <p v-if="error" class="estado-juego__error" role="alert">{{ mensajeError(error) }}</p>

    <p v-if="servidor" class="servidor muted">
      <b>Servidor</b> ({{ datos.origen === 'local' ? 'este backend' : 'VM del juego' }}):
      CPU <b :class="{ malo: servidor.cpu > 80 }">{{ servidor.cpu }} %</b> ·
      event loop p95 <b :class="{ malo: servidor.bucleP95 > 20 }">{{ servidor.bucleP95 }} ms</b> ·
      {{ servidor.rssMb }} MB · {{ servidor.salas }} salas · {{ servidor.sockets }} conexiones ·
      {{ servidor.tickHz }} Hz física / {{ servidor.estadoHz }} Hz estados · encendido {{ uptime(servidor.uptime) }}
      <template v-if="servidor.carga">
        <br />
        {{ servidor.carga.jugando }} salas jugando · {{ servidor.carga.humanos }} personas y {{ servidor.carga.bots }} bots ·
        {{ servidor.carga.canales }} canales rápidos · event loop p50 {{ servidor.bucleP50 }} ms / máx.
        <b :class="{ malo: servidor.bucleMax > 40 }">{{ servidor.bucleMax }} ms</b>
      </template>
      <template v-if="servidor.memoria">
        · heap <b :class="{ malo: servidor.memoria.heapMb > servidor.memoria.heapLimiteMb * 0.8 }">{{ servidor.memoria.heapMb }}</b> de
        {{ servidor.memoria.heapLimiteMb }} MB
      </template>
      <template v-if="servidor.nucleos"> · {{ servidor.nucleos }} núcleos</template>
      <template v-if="servidor.version"> · versión {{ servidor.version }}</template>
    </p>

    <template v-for="grupo in [{ titulo: 'En curso', lista: enCurso }, { titulo: 'Recientes', lista: terminadas }]" :key="grupo.titulo">
      <h3 class="estado-juego__subtitulo">{{ grupo.titulo }}</h3>
      <p v-if="!grupo.lista.length" class="muted">
        {{ grupo.titulo === 'En curso' ? 'Nadie está jugando en el servidor ahora.' : 'Todavía no termina ninguna partida desde que arrancó el servidor.' }}
      </p>
      <ul v-else class="partidas">
        <li v-for="p in grupo.lista" :key="p.id">
          <RouterLink :to="{ name: 'admin-status-partida', params: { partida: p.id } }" class="partida card">
            <div class="partida__cabecera">
              <span class="partida__codigo">{{ p.codigo }}</span>
              <span class="muted">{{ p.circuito }} · {{ p.tipo }}</span>
              <span class="muted partida__cuando">
                <template v-if="p.fin === null">{{ p.fase }} · {{ duracion(p.inicio) }}</template>
                <template v-else>{{ new Date(p.inicio).toLocaleTimeString() }} · duró {{ duracion(p.inicio, p.fin) }}</template>
              </span>
            </div>

            <p v-for="b in p.servidor.banderas" :key="b.texto" class="bandera bandera--malo">{{ b.texto }}</p>

            <ul class="jugadores">
              <li v-for="j in p.jugadores" :key="j.id" class="jugador" :class="`jugador--${peorNivel(banderasDe(p, j))}`">
                <span class="jugador__color" :style="{ background: colorJugador(j.color) }"></span>
                <span class="jugador__nombre">{{ j.nombre }}</span>
                <span :title="textoDispositivo(j.dispositivo)">{{ iconoDispositivo(j.dispositivo) }}</span>
                <span class="muted jugador__numeros">
                  {{ j.fps ?? '—' }} fps · ping {{ j.rttP95 ?? '—' }} ms
                </span>
                <span class="jugador__banderas">
                  <span v-for="b in banderasDe(p, j)" :key="b.clave" class="chip" :class="`chip--${b.nivel}`" :title="b.texto">
                    {{ NOMBRES_BANDERA[b.clave] }}
                  </span>
                  <span v-if="!banderasDe(p, j).length" class="chip chip--bien">Sin problemas</span>
                </span>
              </li>
              <li v-if="!p.jugadores.length" class="muted">Sin reportes de jugadores todavía (llegan cada 2 s).</li>
            </ul>
          </RouterLink>
        </li>
      </ul>
    </template>

    <p class="muted estado-juego__nota">
      Solo salen las partidas que simula el servidor (las locales corren en el navegador). Todo vive en la memoria del
      servidor del juego; al terminar, cada partida se guarda 30 días en la base del juego (sigue aquí aunque se reinicie) y
      desde su detalle se baja como JSON. Las banderas en vivo son de los últimos 30 s; las de una partida terminada, de toda
      la partida.
    </p>
  </section>
</template>

<style scoped>
.estado-juego__cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
}

.estado-juego__titulo {
  font-size: 1.5rem;
  margin: 0;
}

.estado-juego__subtitulo {
  margin: 28px 0 12px;
  font-size: 1.1rem;
}

.estado-juego__error {
  color: var(--extremo);
}

.estado-juego__nota {
  font-size: 0.8rem;
  margin-top: 24px;
}

.servidor {
  font-size: 0.85rem;
  margin-top: 12px;
  line-height: 1.6;
}

.malo {
  color: var(--extremo);
}

.partidas {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.partida {
  display: block;
  padding: 14px 16px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease;
}

.partida:hover {
  border-color: var(--accent);
}

.partida__cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

.partida__codigo {
  font-weight: 700;
}

.partida__cuando {
  margin-left: auto;
  font-size: 0.85rem;
}

.bandera {
  font-size: 0.85rem;
  margin: 8px 0 0;
}

.bandera--malo {
  color: var(--extremo);
}

.jugadores {
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
  display: grid;
  gap: 6px;
}

.jugador {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding-left: 10px;
  border-left: 3px solid var(--ideal);
  font-size: 0.9rem;
}

.jugador--ojo {
  border-left-color: var(--calor);
}

.jugador--malo {
  border-left-color: var(--extremo);
}

.jugador__color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.jugador__nombre {
  font-weight: 600;
}

.jugador__numeros {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.jugador__banderas {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chip {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid currentColor;
}

.chip--malo {
  color: var(--extremo);
}

.chip--ojo {
  color: var(--calor);
}

.chip--bien {
  color: var(--ideal);
}
</style>
