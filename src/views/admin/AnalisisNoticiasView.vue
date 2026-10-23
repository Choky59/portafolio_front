<script setup>
/**
 * Admin: analyze news with the LLM on demand. Analysis costs money, so nothing runs on
 * its own: pick a range (today, last 7 days, this month or custom) and outlets, see what
 * would be analyzed and its estimated cost, and start a job with a spending limit.
 * Already analyzed captures (and the ones in another running job) are left out by the
 * backend, so nothing is paid for twice. The jobs' progress refreshes while one runs.
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import EstadoCarga from '../../components/EstadoCarga.vue'
import EstadoError from '../../components/EstadoError.vue'
import { useApi } from '../../composables/useApi'
import { mensajeError } from '../../api/client'
import { borrarAnalisis, cancelarTrabajo, crearTrabajo, getBorrado, getPendientes, getTrabajos } from '../../api/pulso'

const ZONA = 'America/Hermosillo'
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d)
const hoy = () => ymd(new Date())
const haceDias = (n) => ymd(new Date(Date.now() - n * 86400000))

const PRESETS = [
  { clave: 'hoy', nombre: 'Hoy', rango: () => ({ desde: hoy(), hasta: hoy() }) },
  { clave: '7d', nombre: 'Últimos 7 días', rango: () => ({ desde: haceDias(6), hasta: hoy() }) },
  { clave: 'mes', nombre: 'Este mes', rango: () => ({ desde: `${hoy().slice(0, 7)}-01`, hasta: hoy() }) },
  { clave: 'todo', nombre: 'Todo', rango: () => ({ desde: '', hasta: '' }) },
]

const rango = reactive({ preset: '7d', ...PRESETS[1].rango(), fuentes: [] })
function elegirPreset(p) {
  rango.preset = p.clave
  Object.assign(rango, p.rango())
}
const marcarPropio = () => (rango.preset = 'propio')


/* What the range would analyze (refreshes as the range changes) */
const { data: pendientes, error, loading, reload } = useApi(
  (signal) => getPendientes({ desde: rango.desde || undefined, hasta: rango.hasta || undefined, fuentes: rango.fuentes }, signal),
  { immediate: false }
)
let espera
watch(() => [rango.desde, rango.hasta, rango.fuentes.join()], () => {
  clearTimeout(espera)
  espera = setTimeout(reload, 250)
}, { immediate: true })

/* Which captures (all by default; can untick some) */
const quitadas = ref(new Set())
watch(pendientes, () => (quitadas.value = new Set()))
const capturas = computed(() => pendientes.value?.capturas ?? [])
const elegidas = computed(() => capturas.value.filter((c) => !quitadas.value.has(c._id)))
const costoElegidas = computed(() => elegidas.value.reduce((s, c) => s + c.usdEstimado, 0))
function alternar(id) {
  const s = new Set(quitadas.value)
  s.has(id) ? s.delete(id) : s.add(id)
  quitadas.value = s
}
const ninguna = () => (quitadas.value = new Set(capturas.value.map((c) => c._id)))
const todasElegidas = () => (quitadas.value = new Set())

/* Also search the internet for other outlets' coverage of each relevant event (billed per search) */
const buscarWeb = ref(true)
const busquedas = computed(() => {
  const b = pendientes.value?.resumen?.busquedas
  if (!b || !capturas.value.length) return { busquedas: 0, usd: 0 }
  // Scaled to the captures still ticked
  const parte = elegidas.value.length / capturas.value.length
  const n = Math.round(b.busquedas * parte)
  return { busquedas: n, usd: b.busquedas ? (b.usd / b.busquedas) * n : 0 }
})
const costoTotal = computed(() => costoElegidas.value + (buscarWeb.value ? busquedas.value.usd : 0))

const presupuesto = ref(1)
const presupuestoMax = computed(() => pendientes.value?.resumen?.presupuestoMax ?? 500)
watch(costoTotal, (c) => {
  // Suggest the estimate plus 30% (rounded up to 10 cents), at least 10 cents
  presupuesto.value = Math.min(presupuestoMax.value, Math.max(0.1, Math.ceil(c * 1.3 * 10) / 10))
})

/* Start a job */
const creando = ref(false)
const errorCrear = ref(null)
async function analizar() {
  const n = elegidas.value.length
  const ok = window.confirm(
    `Se analizarán ${n} ${n === 1 ? 'captura' : 'capturas'} con un costo estimado de USD ${costoTotal.value.toFixed(2)}` +
      `${buscarWeb.value ? ` (incluye ~${busquedas.value.busquedas} búsquedas en internet)` : ''}.\n` +
      `El trabajo se detiene solo si llega a USD ${presupuesto.value.toFixed(2)}. ¿Continuar?`
  )
  if (!ok) return
  creando.value = true
  errorCrear.value = null
  try {
    const todas = quitadas.value.size === 0
    await crearTrabajo({
      desde: rango.desde || null,
      hasta: rango.hasta || null,
      fuentes: rango.fuentes,
      ...(todas ? {} : { ids: elegidas.value.map((c) => c._id) }),
      presupuestoUSD: Number(presupuesto.value),
      buscarWeb: buscarWeb.value,
    })
    await Promise.all([reload(), recargarTrabajos()])
  } catch (err) {
    errorCrear.value = err
  } finally {
    creando.value = false
  }
}

/* Jobs and spend; refresh every 4 s while one is active */
const { data: trabajosData, reload: recargarTrabajos } = useApi((signal) => getTrabajos(signal))
const activo = computed(() => trabajosData.value?.trabajos.some((t) => t.estado === 'en_cola' || t.estado === 'corriendo'))
let sondeo = null
watch(activo, (si) => {
  clearInterval(sondeo)
  sondeo = si ? setInterval(() => { recargarTrabajos(); reload() }, 4000) : null
}, { immediate: true })
onBeforeUnmount(() => clearInterval(sondeo))

async function cancelar(t) {
  if (!window.confirm('¿Cancelar este trabajo? Lo ya analizado se queda.')) return
  await cancelarTrabajo(t._id)
  recargarTrabajos()
}

/* Danger zone: delete the analyses of the same range (to analyze them again with the current prompt) */
const vistaBorrado = ref(null)
const errorBorrado = ref(null)
const confirmacion = ref('')
const borrando = ref(false)
const resultadoBorrado = ref(null)
const filtroActual = () => ({ desde: rango.desde || undefined, hasta: rango.hasta || undefined, fuentes: rango.fuentes })
async function revisarBorrado() {
  errorBorrado.value = null
  resultadoBorrado.value = null
  try {
    vistaBorrado.value = await getBorrado(filtroActual())
  } catch (err) {
    errorBorrado.value = err
  }
}
watch(() => [rango.desde, rango.hasta, rango.fuentes.join()], () => {
  vistaBorrado.value = null
  confirmacion.value = ''
})
async function borrar() {
  borrando.value = true
  errorBorrado.value = null
  try {
    const f = filtroActual()
    resultadoBorrado.value = await borrarAnalisis({ desde: f.desde ?? null, hasta: f.hasta ?? null, fuentes: f.fuentes, confirmacion: confirmacion.value })
    vistaBorrado.value = null
    confirmacion.value = ''
    await Promise.all([reload(), recargarTrabajos()])
  } catch (err) {
    errorBorrado.value = err
  } finally {
    borrando.value = false
  }
}

const ESTADOS = { en_cola: 'En cola', corriendo: 'Analizando', terminado: 'Terminado', cancelado: 'Cancelado', detenido: 'Detenido' }
const usd = (v) => `USD ${Number(v ?? 0).toFixed(2)}`
const fecha = (iso) => (iso ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA }).format(new Date(iso)) : '—')
const duracion = (seg) => (seg ? (seg >= 3600 ? `${(seg / 3600).toFixed(1)} h` : `${Math.round(seg / 60)} min`) : '')
const progreso = (t) => (t.totalCapturas ? Math.round(((t.progreso.hechas + t.progreso.errores) / t.totalCapturas) * 100) : 0)
</script>

<template>
  <section class="analisis-admin">
    <header>
      <h2>Análisis de noticias</h2>
      <p class="muted">
        El scraper junta todas las transcripciones sin costo. Aquí eliges cuáles analizar con IA (eso sí cuesta). Lo que ya
        está analizado no se vuelve a pagar.
      </p>
    </header>

    <div v-if="trabajosData" class="gasto">
      <div class="card gasto__item"><span class="muted">Hoy</span><strong>{{ usd(trabajosData.consumo.hoyUSD) }}</strong></div>
      <div class="card gasto__item"><span class="muted">Este mes</span><strong>{{ usd(trabajosData.consumo.mesUSD) }}</strong></div>
      <div class="card gasto__item">
        <span class="muted">Tope diario</span>
        <strong>{{ Math.round((trabajosData.consumo.tokensHoy / trabajosData.consumo.topeDiario) * 100) }}%</strong>
      </div>
    </div>

    <!-- 1. What to analyze -->
    <div class="card paso">
      <h3>1. ¿Qué noticias?</h3>
      <div class="presets" role="group" aria-label="Rango de fechas">
        <button v-for="p in PRESETS" :key="p.clave" type="button" class="chip chip--boton" :aria-pressed="rango.preset === p.clave" @click="elegirPreset(p)">
          {{ p.nombre }}
        </button>
      </div>
      <div class="fechas">
        <label>Desde <input v-model="rango.desde" type="date" @input="marcarPropio" /></label>
        <label>Hasta <input v-model="rango.hasta" type="date" @input="marcarPropio" /></label>
      </div>
      <details class="medios">
        <summary>Medios: {{ rango.fuentes.length ? `${rango.fuentes.length} elegidos` : 'todos' }}</summary>
        <div class="medios__lista">
          <label v-for="f in pendientes?.fuentes ?? []" :key="f.slug">
            <input v-model="rango.fuentes" type="checkbox" :value="f.slug" /> {{ f.nombre }}
          </label>
          <p v-if="!(pendientes?.fuentes ?? []).length" class="muted">Todavía no hay medios registrados por el scraper.</p>
        </div>
      </details>
    </div>

    <!-- 2. Preview -->
    <div class="card paso">
      <h3>2. Lo que se analizaría</h3>
      <EstadoError v-if="error" :error="error" titulo="No se pudo calcular" @reintentar="reload" />
      <EstadoCarga v-else-if="loading && !pendientes" texto="Calculando…" />
      <template v-else-if="pendientes">
        <ul class="resumen">
          <li><strong>{{ pendientes.resumen.pendientes }}</strong> pendientes</li>
          <li><strong>{{ pendientes.resumen.yaAnalizadas }}</strong> ya analizadas <span class="muted">(no se repiten)</span></li>
          <li v-if="pendientes.resumen.enOtroTrabajo"><strong>{{ pendientes.resumen.enOtroTrabajo }}</strong> en otro trabajo</li>
          <li v-if="pendientes.resumen.sinTranscripcion"><strong>{{ pendientes.resumen.sinTranscripcion }}</strong> sin transcripción aún</li>
          <li v-if="pendientes.resumen.conError"><strong>{{ pendientes.resumen.conError }}</strong> con error</li>
        </ul>
        <p v-if="!capturas.length" class="muted">No hay nada pendiente en este rango.</p>
        <div v-if="capturas.length" class="seleccion">
          <span class="muted">{{ elegidas.length }} de {{ capturas.length }} elegidas</span>
          <button type="button" class="btn btn--ghost btn--sm" :disabled="!quitadas.size" @click="todasElegidas">Seleccionar todo</button>
          <button type="button" class="btn btn--ghost btn--sm" :disabled="!elegidas.length" @click="ninguna">Deseleccionar todo</button>
        </div>
        <div v-if="capturas.length" class="tabla" role="region" aria-label="Capturas pendientes" tabindex="0">
          <table>
            <thead>
              <tr><th scope="col"><span class="visually-hidden">Incluir</span></th><th scope="col">Captura</th><th scope="col">Medio</th><th scope="col">Fecha</th><th scope="col">Notas aprox.</th><th scope="col">Costo aprox.</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in capturas" :key="c._id" :class="{ quitada: quitadas.has(c._id) }">
                <td><input type="checkbox" :checked="!quitadas.has(c._id)" :aria-label="`Incluir ${c.titulo}`" @change="alternar(c._id)" /></td>
                <td>{{ c.titulo || c.clave }} <span class="muted">{{ duracion(c.duracionSeg) }}</span></td>
                <td>{{ c.nombreFuente }}</td>
                <td>{{ fecha(c.publicadoEn) }}</td>
                <td>{{ c.notasEstimadas }}</td>
                <td>{{ usd(c.usdEstimado) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- 3. Start -->
    <div v-if="capturas.length" class="card paso">
      <h3>3. Analizar</h3>
      <p>
        <strong>{{ elegidas.length }}</strong> {{ elegidas.length === 1 ? 'captura' : 'capturas' }} · costo estimado
        <strong>{{ usd(costoTotal) }}</strong>&nbsp;<span class="muted">(aproximado: depende de cuántas notas salgan)</span>
      </p>
      <label class="opcion">
        <input v-model="buscarWeb" type="checkbox" />
        Buscar en internet otros medios que cubrieron cada suceso
        <span class="muted">(~{{ busquedas.busquedas }} búsquedas, {{ usd(busquedas.usd) }}; solo sucesos relevantes o de 2+ medios)</span>
      </label>
      <label class="presupuesto">
        Detener si se gastan más de USD
        <input v-model.number="presupuesto" type="number" min="0.01" :max="presupuestoMax" step="0.1" />
      </label>
      <p v-if="errorCrear" class="error">{{ mensajeError(errorCrear) }}</p>
      <button type="button" class="btn" :disabled="creando || !elegidas.length || !(presupuesto > 0)" @click="analizar">
        {{ creando ? 'Iniciando…' : `Analizar ${elegidas.length} (~${usd(costoTotal)})` }}
      </button>
    </div>

    <!-- Jobs -->
    <div class="paso">
      <h3>Trabajos</h3>
      <p v-if="!(trabajosData?.trabajos ?? []).length" class="muted">Todavía no hay trabajos.</p>
      <ul class="trabajos">
        <li v-for="t in trabajosData?.trabajos ?? []" :key="t._id" class="card trabajo">
          <header class="trabajo__cabeza">
            <span class="trabajo__estado" :data-estado="t.estado">{{ ESTADOS[t.estado] }}</span>
            <span class="muted">{{ fecha(t.creadoEn) }} · {{ t.filtros.desde || 'inicio' }} → {{ t.filtros.hasta || 'hoy' }}</span>
            <button v-if="t.estado === 'en_cola' || t.estado === 'corriendo'" type="button" class="btn btn--ghost btn--sm" @click="cancelar(t)">Cancelar</button>
          </header>
          <div class="barra" role="progressbar" :aria-valuenow="progreso(t)" aria-valuemin="0" aria-valuemax="100" :aria-label="`Progreso ${progreso(t)}%`">
            <span :style="{ width: `${progreso(t)}%` }" />
          </div>
          <p class="trabajo__datos">
            {{ t.progreso.hechas }} de {{ t.totalCapturas }} capturas · {{ t.progreso.notas }} notas
            <template v-if="t.progreso.errores"> · <span class="error">{{ t.progreso.errores }} con error</span></template>
            · {{ usd(t.progreso.costoUSD) }} de {{ usd(t.presupuestoUSD) }}
            <span class="muted">(estimado {{ usd(t.estimadoUSD) }})</span>
          </p>
          <p v-if="t.motivo" class="muted">{{ t.estado === 'terminado' ? '' : 'Motivo: ' }}{{ t.motivo }}</p>
          <p v-if="t.ultimoError" class="error trabajo__error">{{ t.ultimoError }}</p>
        </li>
      </ul>
    </div>

    <!-- Danger zone -->
    <div class="card paso peligro">
      <h3>Zona de peligro: borrar análisis</h3>
      <p class="muted">
        Borra para siempre las notas analizadas del rango elegido arriba
        (<strong>{{ rango.desde || 'inicio' }} → {{ rango.hasta || 'hoy' }}</strong>, {{ rango.fuentes.length ? `${rango.fuentes.length} medios` : 'todos los medios' }})
        y las regresa a pendientes para analizarlas otra vez con el prompt actual. Las transcripciones, el gasto registrado y el
        historial de trabajos se quedan. Con <strong>Todo</strong> también se vacían los sucesos y los catálogos creados por la IA.
      </p>
      <button v-if="!vistaBorrado" type="button" class="btn btn--ghost" @click="revisarBorrado">Ver qué se borraría</button>
      <template v-else>
        <ul class="resumen">
          <li><strong>{{ vistaBorrado.notas }}</strong> notas</li>
          <li><strong>{{ vistaBorrado.capturas }}</strong> capturas vuelven a pendientes</li>
          <li><strong>{{ vistaBorrado.eventosQueSeBorran }}</strong> sucesos se borran<template v-if="!vistaBorrado.todo && vistaBorrado.eventosAfectados > vistaBorrado.eventosQueSeBorran">, {{ vistaBorrado.eventosAfectados - vistaBorrado.eventosQueSeBorran }} pierden notas</template></li>
        </ul>
        <p v-if="vistaBorrado.trabajoActivo || activo" class="error">Hay un trabajo activo: cancélalo o espera a que termine para borrar.</p>
        <p v-else-if="!vistaBorrado.notas && !vistaBorrado.capturas" class="muted">No hay análisis en este rango.</p>
        <template v-else>
          <label class="presupuesto">
            Escribe BORRAR para confirmar
            <input v-model="confirmacion" type="text" autocomplete="off" spellcheck="false" aria-describedby="borrar-ayuda" />
          </label>
          <p id="borrar-ayuda" class="muted">No se puede deshacer.</p>
          <button type="button" class="btn btn--peligro" :disabled="borrando || confirmacion !== 'BORRAR'" @click="borrar">
            {{ borrando ? 'Borrando…' : `Borrar ${vistaBorrado.notas} notas` }}
          </button>
        </template>
      </template>
      <p v-if="errorBorrado" class="error">{{ mensajeError(errorBorrado) }}</p>
      <p v-if="resultadoBorrado" role="status">
        Listo: {{ resultadoBorrado.notas }} notas y {{ resultadoBorrado.eventos }} sucesos borrados; {{ resultadoBorrado.capturas }} capturas quedaron pendientes.
      </p>
    </div>
  </section>
</template>

<style scoped>
.analisis-admin {
  display: grid;
  gap: 18px;
}

h2 {
  font-size: 1.9rem;
}

h3 {
  font-family: var(--font-body);
  font-size: 1.05rem;
  margin: 0 0 10px;
}

.gasto {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.gasto__item {
  display: grid;
  padding: 10px 14px;
}

.gasto__item strong {
  font-size: 1.3rem;
}

.paso {
  padding: 16px;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip--boton {
  border: 1px solid var(--border);
  cursor: pointer;
  font: inherit;
  color: var(--text);
}

.chip--boton[aria-pressed='true'] {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}

.fechas {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 12px 0;
}

.fechas label,
.presupuesto {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.fechas input,
.presupuesto input {
  min-height: 38px;
  padding: 4px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.presupuesto input {
  width: 100px;
}

.medios summary {
  cursor: pointer;
  font-weight: 600;
}

.medios__lista {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 4px 16px;
  margin-top: 8px;
}

.resumen {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
}

.tabla {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th,
td {
  padding: 6px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

th {
  position: sticky;
  top: 0;
  background: var(--surface-2);
}

tr.quitada {
  opacity: 0.45;
}

.trabajos {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.trabajo {
  padding: 14px;
  display: grid;
  gap: 8px;
}

.trabajo__cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.trabajo__cabeza .btn {
  margin-left: auto;
}

.trabajo__estado {
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.85rem;
  background: var(--surface-2);
}

.trabajo__estado[data-estado='corriendo'] {
  background: var(--accent);
  color: var(--on-accent);
}

.trabajo__estado[data-estado='terminado'] {
  background: var(--ideal);
  color: #12261f;
}

.trabajo__estado[data-estado='detenido'],
.trabajo__estado[data-estado='cancelado'] {
  background: var(--extremo);
  color: #fff;
}

.trabajo__datos {
  margin: 0;
}

.trabajo__error {
  font-size: 0.85rem;
  word-break: break-word;
}

.barra {
  height: 8px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.barra span {
  display: block;
  height: 100%;
  background: var(--accent);
}

.error {
  color: var(--extremo);
}

.opcion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
}

.seleccion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.peligro {
  border: 2px solid var(--extremo);
  display: grid;
  gap: 10px;
  justify-items: start;
}

.peligro h3,
.peligro p {
  margin: 0;
}

.btn--peligro {
  background: var(--extremo);
  border-color: var(--extremo);
  color: #fff;
}

.btn--peligro:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
