<script setup>
/**
 * One analyzed news item: title, outlet, date, topic, emotion mix, how many outlets told
 * the same happening and the link to the exact minute. The rest (summary, why each
 * emotion, the subtopic's detail, people, figures, upcoming events, quotes with their
 * minute, places, the event's discrepancies) is in an expandable detail.
 */
import { computed } from 'vue'
import BarraApilada from './BarraApilada.vue'
import BarraTono from './BarraTono.vue'
import {
  EMOCIONES, AMBITOS, NIVELES, TIPOS, TONOS, colorEmocion, cuandoOcurrio, fecha, filasDetalle, intensidadEnPalabras, minuto,
  nombreEmocion, nombreSubtema, nombreTema,
} from './catalogo'

const props = defineProps({
  nota: { type: Object, required: true },
  nombreFuente: { type: String, default: '' },
  /** The full analysis starts expanded (the news modal of the crowd) */
  abierto: { type: Boolean, default: false },
  /** "Por qué esas emociones" right under the emotions bar instead of inside the full analysis (the crowd's modal) */
  emocionesPrimero: { type: Boolean, default: false },
})
const emit = defineEmits(['filtrar'])

const n = computed(() => props.nota)
const emociones = computed(() =>
  EMOCIONES.map((e) => {
    const x = n.value.sentimiento.emociones?.[e.clave]
    return { clave: e.clave, etiqueta: e.etiqueta, valor: x?.valor ?? 0, explicacion: x?.explicacion ?? null, color: colorEmocion(e.clave) }
  })
    .filter((e) => e.valor > 0)
    .sort((a, b) => b.valor - a.valor)
)
const explicadas = computed(() => emociones.value.filter((e) => e.explicacion))
const evento = computed(() => n.value.eventoInfo)
const otrosMedios = computed(() => (evento.value ? evento.value.numMedios - 1 : 0))
const detalle = computed(() => filasDetalle(n.value.detalle))
const ocurrio = computed(() => cuandoOcurrio(n.value.tiempoLocal))
/** Other notes of the same event we have (each outlet's link) and what was found online */
const cobertura = computed(() => evento.value?.cobertura ?? [])
const coberturaWeb = computed(() => evento.value?.coberturaWeb ?? [])
/** The other note's link, at its minute when it's a video */
const enlaceDe = (c) => (c.enlace && c.inicio !== null && c.enlace.includes('youtu') ? c.enlace.replace(/(\?t=\d+)?$/, `?t=${Math.floor(c.inicio)}`) : c.enlace)
/** Google News with the title and the city, for whatever we didn't find */
const googleNoticias = computed(() => {
  const q = `${evento.value?.titulo || n.value.titulo} Hermosillo`
  return `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=es-419&gl=MX&ceid=MX:es-419`
})
const esVideo = computed(() => n.value.enlace?.includes('youtu'))
const posturas = computed(() =>
  Object.entries(n.value.sentimiento.posturaGobierno).filter(([, v]) => v !== null).map(([nivel, v]) => ({ nivel, v }))
)
const lugares = computed(() => n.value.lugares.filter((l) => l.rol === 'lugar_del_hecho'))
/** Quote link: the video at that second */
const enlaceCita = (c) => (esVideo.value && c.segundo !== null ? n.value.enlace.replace(/(\?t=\d+)?$/, `?t=${Math.floor(c.segundo)}`) : null)
</script>

<template>
  <article class="nota card" :style="{ '--emo': colorEmocion(n.sentimiento.emocionDominante) }">
    <header class="nota__cabeza">
      <p class="nota__meta muted">
        {{ nombreFuente || n.fuente }} · {{ fecha(n.publicadoEn) }}
        <template v-if="n.tiempo"> · min {{ minuto(n.tiempo.inicio) }}</template>
        <span v-if="n.clasificacion.esAlerta" class="nota__alerta">Alerta</span>
      </p>
      <h3 class="nota__titulo">{{ n.titulo }}</h3>
      <p class="nota__resumen">{{ n.resumenCorto }}</p>
      <p v-if="ocurrio" class="nota__meta muted">{{ ocurrio }}</p>
    </header>

    <div class="nota__chips">
      <button type="button" class="chip chip--boton" @click="emit('filtrar', { tema: n.clasificacion.tema })">
        {{ nombreTema(n.clasificacion.tema) }}
      </button>
      <button
        v-if="nombreSubtema(n.clasificacion.subtema) !== nombreTema(n.clasificacion.tema)"
        type="button"
        class="chip chip--boton"
        @click="emit('filtrar', { tema: n.clasificacion.tema, subtema: n.clasificacion.subtema })"
      >
        {{ nombreSubtema(n.clasificacion.subtema) }}
      </button>
      <span class="chip">{{ TIPOS[n.clasificacion.tipo] }} · {{ AMBITOS[n.clasificacion.ambito] }}</span>
      <button type="button" class="chip chip--boton" @click="emit('filtrar', { emocion: n.sentimiento.emocionDominante })">
        <span class="punto" aria-hidden="true" /> {{ nombreEmocion(n.sentimiento.emocionDominante) }}
      </button>
      <span v-if="otrosMedios > 0" class="chip chip--evento" :title="evento.fuentes.join(', ')">
        También lo {{ otrosMedios === 1 ? 'cubrió otro medio' : `cubrieron ${otrosMedios} medios más` }}
      </span>
    </div>

    <BarraApilada :segmentos="emociones" :alto="10" />
    <p v-if="n.sentimiento.intensidad !== undefined" class="nota__meta muted">{{ intensidadEnPalabras(n.sentimiento.intensidad) }}</p>

    <section v-if="emocionesPrimero && explicadas.length" class="nota__por-que">
      <h4>Por qué esas emociones</h4>
      <ul class="nota__emociones">
        <li v-for="e in explicadas" :key="e.clave">
          <span class="punto" :style="{ background: e.color }" aria-hidden="true" />
          <strong>{{ e.etiqueta }} {{ Math.round(e.valor * 100) }}%</strong> · {{ e.explicacion }}
        </li>
      </ul>
    </section>

    <div class="nota__acciones">
      <a v-if="n.enlace" :href="n.enlace" target="_blank" rel="noopener" class="btn btn--sm">
        {{ esVideo ? `▶ Ver en el minuto ${minuto(n.tiempo?.inicio ?? 0)}` : 'Leer la nota' }} ↗
      </a>
      <a :href="googleNoticias" target="_blank" rel="noopener" class="btn btn--ghost btn--sm">Buscar en Google Noticias ↗</a>
    </div>

    <div v-if="cobertura.length || coberturaWeb.length" class="nota__cobertura">
      <h4>Otros medios que lo cubrieron</h4>
      <ul>
        <li v-for="c in cobertura" :key="c.id">
          <a v-if="c.enlace" :href="enlaceDe(c)" target="_blank" rel="noopener"><strong>{{ c.nombre }}</strong></a>
          <strong v-else>{{ c.nombre }}</strong>
          <span class="muted"> · {{ c.titulo }} · {{ fecha(c.publicadoEn) }}</span>
        </li>
        <li v-for="w in coberturaWeb" :key="w.url">
          <a :href="w.url" target="_blank" rel="noopener nofollow"><strong>{{ w.medio }}</strong></a>
          <span class="muted"> · {{ w.titulo }}<template v-if="w.fecha"> · {{ fecha(`${w.fecha}T19:00:00Z`) }}</template></span>
          <span class="chip chip--web" title="Encontrada con una búsqueda en internet">web</span>
        </li>
      </ul>
    </div>

    <details class="nota__detalle" :open="abierto">
      <summary>Ver el análisis completo</summary>

      <p>{{ n.resumen }}</p>
      <ul v-if="n.puntosClave.length" class="nota__puntos">
        <li v-for="p in n.puntosClave" :key="p">{{ p }}</li>
      </ul>

      <template v-if="!emocionesPrimero && explicadas.length">
        <h4>Por qué esas emociones</h4>
        <ul class="nota__emociones">
          <li v-for="e in explicadas" :key="e.clave">
            <span class="punto" :style="{ background: e.color }" aria-hidden="true" />
            <strong>{{ e.etiqueta }} {{ Math.round(e.valor * 100) }}%</strong> · {{ e.explicacion }}
          </li>
        </ul>
      </template>

      <template v-if="detalle.length">
        <h4>Los datos del hecho</h4>
        <dl class="nota__datos">
          <template v-for="d in detalle" :key="d.etiqueta">
            <dt class="muted">{{ d.etiqueta }}</dt>
            <dd>{{ d.valor }}</dd>
          </template>
        </dl>
      </template>

      <template v-if="evento && evento.notas > 1">
        <h4>El mismo suceso en {{ evento.numMedios === 1 ? 'otras notas' : `${evento.numMedios} medios` }}</h4>
        <p v-if="evento.resumen">{{ evento.resumen }}</p>
        <template v-if="evento.discrepancias.length">
          <p class="muted">En qué no coinciden:</p>
          <ul>
            <li v-for="d in evento.discrepancias" :key="d">{{ d }}</li>
          </ul>
        </template>
      </template>

      <h4>Cómo se cuenta</h4>
      <p class="muted">
        Tono del medio: <strong>{{ TONOS[n.sentimiento.tonoMedio] }}</strong> · polémica {{ Math.round(n.sentimiento.polemica * 100) }}%.
        {{ n.sentimiento.justificacion }}
      </p>
      <div v-if="posturas.length" class="nota__posturas">
        <div v-for="p in posturas" :key="p.nivel" class="nota__postura">
          <span>Gobierno {{ NIVELES[p.nivel].toLowerCase() }}</span>
          <BarraTono :valor="p.v" :etiqueta="`Tono hacia el gobierno ${NIVELES[p.nivel].toLowerCase()}`" />
        </div>
      </div>

      <template v-if="n.actores.length">
        <h4>Quiénes aparecen</h4>
        <ul class="nota__actores">
          <li v-for="a in n.actores" :key="a.nombre">
            <button v-if="a.nombre !== 'Menor de edad'" type="button" class="nota__actor" @click="emit('filtrar', { actor: a.nombre })">
              {{ a.nombre }}
            </button>
            <span v-else>{{ a.nombre }}</span>
            <span v-if="a.cargo" class="muted"> · {{ a.cargo }}</span>
            <span class="muted"> · {{ a.rol.replace('_', ' ') }}</span>
          </li>
        </ul>
      </template>

      <template v-if="n.cifras.length">
        <h4>Cifras</h4>
        <ul class="nota__cifras">
          <li v-for="c in n.cifras" :key="c.queMide + c.valor">
            <strong>{{ new Intl.NumberFormat('es-MX').format(c.valor) }} {{ c.unidad }}</strong> <span class="muted">{{ c.queMide }}</span>
          </li>
        </ul>
      </template>

      <template v-if="n.fechas.proximosEventos.length">
        <h4>Lo que viene</h4>
        <ul>
          <li v-for="e in n.fechas.proximosEventos" :key="e.que">
            <strong v-if="e.desde">{{ e.desde }}{{ e.hasta && e.hasta !== e.desde ? ` al ${e.hasta}` : '' }}:</strong> {{ e.que }}
          </li>
        </ul>
      </template>

      <template v-if="lugares.length">
        <h4>Dónde</h4>
        <p class="muted">{{ lugares.map((l) => l.mencion).join(' · ') }}</p>
      </template>

      <template v-if="n.citas.length">
        <h4>Lo que se dijo</h4>
        <ul class="nota__citas">
          <li v-for="c in n.citas" :key="c.segmento + c.texto">
            <q>{{ c.texto }}</q>
            <span v-if="c.quien" class="muted"> — {{ c.quien }}</span>
            <span v-if="c.atribuidaA && c.atribuidaA !== c.quien" class="muted">, según {{ c.atribuidaA }}</span>
            <a v-if="enlaceCita(c)" :href="enlaceCita(c)" target="_blank" rel="noopener" class="nota__minuto">min {{ minuto(c.segundo) }} ↗</a>
          </li>
        </ul>
      </template>
    </details>
  </article>
</template>

<style scoped>
.nota {
  display: grid;
  gap: 10px;
  padding: 16px;
  border-left: 5px solid var(--emo);
}

.nota__meta {
  margin: 0 0 4px;
  font-size: 0.8rem;
}

.nota__alerta {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--extremo);
  color: #fff;
  font-weight: 700;
}

.nota__titulo {
  font-family: var(--font-body);
  font-size: 1.1rem;
  line-height: 1.3;
  margin: 0;
}

.nota__resumen {
  margin: 4px 0 0;
}

.nota__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.nota__chips .chip {
  font: 500 0.85rem var(--font-body);
  border: 1px solid var(--border);
  color: var(--text);
}

.chip--boton {
  cursor: pointer;
}

.punto {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--emo);
  border: 1.5px solid var(--border);
  vertical-align: -1px;
}

.nota__acciones {
  display: flex;
  gap: 8px;
}

.nota__detalle summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--accent-ink);
}

.nota__detalle h4 {
  margin: 16px 0 6px;
  font-family: var(--font-body);
  font-size: 0.95rem;
}

.nota__detalle ul {
  margin: 0;
  padding-left: 18px;
}

.nota__posturas {
  display: grid;
  gap: 6px;
  max-width: 460px;
}

.nota__postura {
  display: grid;
  grid-template-columns: 130px 1fr;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
}

.nota__actor {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-ink);
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.nota__cobertura h4,
.nota__por-que h4 {
  margin: 0 0 4px;
  font-family: var(--font-body);
  font-size: 0.95rem;
}

.nota__cobertura ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 3px;
  font-size: 0.9rem;
}

.chip--web {
  margin-left: 4px;
  padding: 0 6px;
  font-size: 0.7rem;
  border: 1px solid var(--border);
}

.nota__acciones {
  flex-wrap: wrap;
}

.chip--evento {
  background: var(--surface-2, transparent);
  font-weight: 700;
}

.nota__emociones {
  list-style: none;
  margin: 0;
  padding-left: 0 !important;
  display: grid;
  gap: 4px;
}

.nota__emociones .punto {
  margin-right: 4px;
}

.nota__datos {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 12px;
  margin: 0;
  font-size: 0.9rem;
}

.nota__datos dd {
  margin: 0;
}

.nota__citas li + li {
  margin-top: 6px;
}

.nota__minuto {
  margin-left: 6px;
  font-size: 0.8rem;
  white-space: nowrap;
}
</style>
