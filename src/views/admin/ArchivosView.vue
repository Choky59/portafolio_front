<script setup>
/**
 * Project file manager (Firebase Storage).
 * The browser uploads straight to Storage with a signed URL from the backend,
 * one file at a time, with progress. Files are organized by project slug;
 * "Copiar para JSON" gives the snippet to paste in content/proyectos/<slug>.json.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EstadoCarga from '../../components/EstadoCarga.vue'
import EstadoError from '../../components/EstadoError.vue'
import { useApi } from '../../composables/useApi'
import { mensajeError } from '../../api/client'
import { listProyectos } from '../../api/proyectos'
import * as ArchivosApi from '../../api/archivos'
import { ACCEPT, CATEGORIAS, clasificar, formatearTamano, fragmentoJson } from './archivos.tipos'

const route = useRoute()
const router = useRouter()

/* Project selection (kept in ?slug= so the link can be shared) */
const { data: proyectos, error: errorProyectos, reload: recargarProyectos } = useApi(listProyectos)
const slug = computed({
  get: () => (typeof route.query.slug === 'string' ? route.query.slug : ''),
  set: (valor) => router.replace({ query: { ...route.query, slug: valor || undefined } }),
})

watch(proyectos, (lista) => {
  if (!slug.value && lista?.length) slug.value = lista[0].slug
})

/* Files of the selected project */
const archivos = ref(null)
const cargando = ref(false)
const errorLista = ref(null)
let controller = null

async function cargarArchivos() {
  if (!slug.value) return
  controller?.abort()
  const actual = (controller = new AbortController())
  cargando.value = true
  errorLista.value = null
  try {
    const lista = await ArchivosApi.listarArchivos(slug.value, actual.signal)
    if (!actual.signal.aborted) archivos.value = lista
  } catch (err) {
    if (err?.name !== 'AbortError') errorLista.value = err
  } finally {
    if (actual === controller) cargando.value = false
  }
}

watch(slug, () => {
  archivos.value = null
  cargarArchivos()
}, { immediate: true })

const grupos = computed(() =>
  Object.entries(CATEGORIAS)
    .map(([clave, info]) => ({ clave, ...info, archivos: (archivos.value ?? []).filter((a) => a.categoria === clave) }))
    .filter((g) => g.archivos.length)
)

/* Upload queue: one file at a time */
const cola = reactive([])
let siguienteId = 1
let procesando = false

const subiendo = computed(() => cola.some((t) => t.estado === 'esperando' || t.estado === 'subiendo' || t.estado === 'confirmando'))

function agregar(files) {
  for (const file of files) {
    const tipo = clasificar(file)
    cola.push({
      id: siguienteId++,
      file,
      slug: slug.value,
      contentType: tipo.contentType ?? null,
      estado: tipo.error ? 'rechazado' : 'esperando',
      progreso: 0,
      error: tipo.error ?? null,
      cancelar: null,
    })
  }
  procesarCola()
}

async function subir(tarea) {
  tarea.estado = 'subiendo'
  tarea.progreso = 0
  tarea.error = null
  try {
    const autorizada = await ArchivosApi.pedirSubida({
      slug: tarea.slug,
      nombre: tarea.file.name,
      contentType: tarea.contentType,
      tamano: tarea.file.size,
    })

    const { promesa, cancelar } = ArchivosApi.subirArchivo(
      autorizada.uploadUrl,
      tarea.file,
      autorizada.headers,
      (p) => (tarea.progreso = p)
    )
    tarea.cancelar = cancelar
    await promesa

    tarea.estado = 'confirmando'
    await ArchivosApi.confirmarSubida(autorizada.path, tarea.file.name)
    tarea.estado = 'listo'
    if (tarea.slug === slug.value) cargarArchivos()
  } catch (err) {
    tarea.estado = err?.name === 'AbortError' ? 'cancelado' : 'error'
    tarea.error = err?.name === 'AbortError' ? null : mensajeError(err)
  } finally {
    tarea.cancelar = null
  }
}

async function procesarCola() {
  if (procesando) return
  procesando = true
  try {
    let tarea
    while ((tarea = cola.find((t) => t.estado === 'esperando'))) {
      await subir(tarea)
    }
  } finally {
    procesando = false
  }
}

function reintentar(tarea) {
  tarea.estado = 'esperando'
  procesarCola()
}

function quitarTerminadas() {
  for (let i = cola.length - 1; i >= 0; i--) {
    if (['listo', 'rechazado', 'cancelado'].includes(cola[i].estado)) cola.splice(i, 1)
  }
}

/* Drop zone */
const arrastrando = ref(false)
const input = ref(null)

function onDrop(e) {
  arrastrando.value = false
  if (e.dataTransfer?.files?.length) agregar([...e.dataTransfer.files])
}

function onElegir(e) {
  agregar([...e.target.files])
  e.target.value = ''
}

/* Don't lose uploads by closing the tab */
function avisarSalida(e) {
  if (subiendo.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', avisarSalida))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', avisarSalida)
  controller?.abort()
  cola.forEach((t) => t.cancelar?.())
})

/* File actions */
const copiado = ref(null)
const ocupado = ref(null)
const errorAccion = ref(null)

async function copiar(texto, clave) {
  try {
    await navigator.clipboard.writeText(texto)
    copiado.value = clave
    setTimeout(() => {
      if (copiado.value === clave) copiado.value = null
    }, 2000)
  } catch {
    window.prompt('Copia el texto:', texto)
  }
}

async function confirmar(archivo) {
  ocupado.value = archivo.path
  errorAccion.value = null
  try {
    await ArchivosApi.confirmarSubida(archivo.path, archivo.nombre)
    await cargarArchivos()
  } catch (err) {
    errorAccion.value = { path: archivo.path, mensaje: mensajeError(err) }
  } finally {
    ocupado.value = null
  }
}

async function borrar(archivo) {
  if (!confirm(`¿Borrar "${archivo.nombre}"? Si su URL está en el JSON de un proyecto, dejará de funcionar.`)) return
  ocupado.value = archivo.path
  errorAccion.value = null
  try {
    await ArchivosApi.borrarArchivo(archivo.path)
    await cargarArchivos()
  } catch (err) {
    errorAccion.value = { path: archivo.path, mensaje: mensajeError(err) }
  } finally {
    ocupado.value = null
  }
}

const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

const ESTADOS = {
  esperando: 'En espera',
  subiendo: 'Subiendo',
  confirmando: 'Terminando',
  listo: 'Listo',
  error: 'Error',
  rechazado: 'No permitido',
  cancelado: 'Cancelado',
}
</script>

<template>
  <section class="archivos">
    <h2 class="archivos__titulo">Archivos</h2>

    <EstadoError v-if="errorProyectos" :error="errorProyectos" titulo="No se pudieron cargar los proyectos" @reintentar="recargarProyectos" />

    <div v-else class="field archivos__proyecto">
      <label for="a-proyecto">Proyecto</label>
      <select id="a-proyecto" v-model="slug" class="input">
        <option v-for="p in proyectos ?? []" :key="p.slug" :value="p.slug">#{{ p.numero }} {{ p.titulo }}</option>
      </select>
    </div>

    <!-- Drop zone -->
    <div
      v-if="slug"
      class="zona"
      :class="{ 'zona--activa': arrastrando }"
      @dragover.prevent="arrastrando = true"
      @dragleave.prevent="arrastrando = false"
      @drop.prevent="onDrop"
    >
      <p class="zona__icono" aria-hidden="true">⬆</p>
      <p><strong>Arrastra aquí tus archivos</strong> o</p>
      <button type="button" class="btn btn--sm" @click="input?.click()">Elegir archivos</button>
      <input ref="input" type="file" multiple :accept="ACCEPT" class="visually-hidden" @change="onElegir" />
      <p class="muted zona__ayuda">
        Videos mp4/webm/mov (hasta 1 GB) · código .zip (200 MB) · imágenes jpg/png/webp (20 MB) · modelos .glb (100 MB)
      </p>
    </div>

    <!-- Upload queue -->
    <div v-if="cola.length" class="cola card">
      <div class="cola__cabecera">
        <h3>Subidas</h3>
        <button v-if="!subiendo" type="button" class="btn btn--ghost btn--sm" @click="quitarTerminadas">Limpiar</button>
      </div>
      <ul class="cola__lista" aria-live="polite">
        <li v-for="t in cola" :key="t.id" class="tarea" :class="`tarea--${t.estado}`">
          <div class="tarea__fila">
            <span class="tarea__nombre">{{ t.file.name }}</span>
            <span class="muted">{{ formatearTamano(t.file.size) }}</span>
            <span class="tarea__estado">{{ ESTADOS[t.estado] }}{{ t.estado === 'subiendo' ? ` ${Math.round(t.progreso * 100)}%` : '' }}</span>
          </div>
          <progress
            v-if="t.estado === 'subiendo' || t.estado === 'confirmando'"
            :value="t.estado === 'confirmando' ? 1 : t.progreso"
            max="1"
            :aria-label="`Progreso de ${t.file.name}`"
          />
          <p v-if="t.error" class="tarea__error">{{ t.error }}</p>
          <div class="tarea__acciones">
            <button v-if="t.estado === 'subiendo' && t.cancelar" type="button" class="btn btn--ghost btn--sm" @click="t.cancelar()">Cancelar</button>
            <button v-if="t.estado === 'error' || t.estado === 'cancelado'" type="button" class="btn btn--ghost btn--sm" @click="reintentar(t)">Reintentar</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Project files -->
    <template v-if="slug">
      <EstadoCarga v-if="cargando && !archivos" texto="Cargando archivos…" />
      <EstadoError v-else-if="errorLista" :error="errorLista" @reintentar="cargarArchivos" />
      <p v-else-if="archivos && !archivos.length" class="muted vacio">Este proyecto todavía no tiene archivos.</p>

      <section v-for="g in grupos" :key="g.clave" class="grupo" :aria-labelledby="`g-${g.clave}`">
        <h3 :id="`g-${g.clave}`">{{ g.titulo }} <span class="muted grupo__cuenta">({{ g.archivos.length }})</span></h3>
        <p class="muted grupo__ayuda">"Copiar para JSON" da el fragmento para pegarlo {{ g.dondePegar }}.</p>

        <ul class="lista">
          <li v-for="a in g.archivos" :key="a.path" class="archivo card" :aria-busy="ocupado === a.path">
            <div class="archivo__vista">
              <video v-if="a.categoria === 'videos' && a.url" :src="a.url" preload="metadata" muted controls playsinline />
              <img v-else-if="a.categoria === 'imagenes' && a.url" :src="a.url" alt="" loading="lazy" />
              <span v-else class="archivo__icono" aria-hidden="true">{{ a.categoria === 'descargas' ? '🗜️' : a.categoria === 'modelos' ? '🧊' : '🎞️' }}</span>
            </div>

            <div class="archivo__info">
              <p class="archivo__nombre">{{ a.nombre }}</p>
              <p class="muted archivo__meta">{{ formatearTamano(a.tamano) }} · {{ fecha.format(new Date(a.subidoEn)) }}</p>

              <p v-if="!a.url" class="archivo__pendiente">
                La subida no se terminó de registrar.
                <button type="button" class="btn btn--ghost btn--sm" :disabled="ocupado === a.path" @click="confirmar(a)">Terminar</button>
              </p>

              <p v-if="errorAccion?.path === a.path" class="tarea__error" role="alert">{{ errorAccion.mensaje }}</p>

              <div class="archivo__acciones">
                <template v-if="a.url">
                  <button type="button" class="btn btn--sm" @click="copiar(a.url, `url:${a.path}`)">
                    {{ copiado === `url:${a.path}` ? '¡Copiada!' : 'Copiar URL' }}
                  </button>
                  <button type="button" class="btn btn--ghost btn--sm" @click="copiar(fragmentoJson(a), `json:${a.path}`)">
                    {{ copiado === `json:${a.path}` ? '¡Copiado!' : 'Copiar para JSON' }}
                  </button>
                  <a :href="a.url" target="_blank" rel="noopener" class="btn btn--ghost btn--sm">Abrir ↗</a>
                </template>
                <button type="button" class="btn btn--danger btn--sm" :disabled="ocupado === a.path" @click="borrar(a)">Borrar</button>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style scoped>
.archivos__titulo {
  font-size: 2.2rem;
}

.archivos__proyecto {
  max-width: 420px;
}

.zona {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 28px 16px;
  margin-bottom: 20px;
  text-align: center;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.zona--activa {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.zona p {
  margin: 0;
}

.zona__icono {
  font-size: 1.8rem;
}

.zona__ayuda {
  margin-top: 8px !important;
  font-size: 0.85rem;
}

.cola {
  padding: 16px;
  margin-bottom: 24px;
}

.cola__cabecera {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cola__cabecera h3 {
  font-size: 1.5rem;
  margin: 0;
}

.cola__lista {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  gap: 12px;
}

.tarea__fila {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: baseline;
}

.tarea__nombre {
  font-weight: 600;
  word-break: break-all;
}

.tarea__estado {
  margin-left: auto;
  font-size: 0.85rem;
  font-weight: 600;
}

.tarea--listo .tarea__estado { color: var(--ideal); }
.tarea--error .tarea__estado,
.tarea--rechazado .tarea__estado { color: var(--extremo); }

.tarea progress {
  width: 100%;
  height: 8px;
  accent-color: var(--accent);
}

.tarea__error {
  color: var(--extremo);
  font-size: 0.9rem;
  margin: 4px 0;
}

.tarea__acciones {
  display: flex;
  gap: 8px;
}

.vacio {
  padding: 24px 0;
}

.grupo {
  margin-top: 28px;
}

.grupo h3 {
  font-size: 1.7rem;
  margin-bottom: 2px;
}

.grupo__cuenta {
  font-family: var(--font-body);
  font-size: 1rem;
}

.grupo__ayuda {
  font-size: 0.85rem;
}

.lista {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

@media (min-width: 900px) {
  .lista {
    grid-template-columns: repeat(2, 1fr);
  }
}

.archivo {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 14px;
  padding: 14px;
}

.archivo[aria-busy='true'] {
  opacity: 0.6;
}

.archivo__vista {
  display: grid;
  place-items: center;
  width: 96px;
  height: 128px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
}

.archivo__vista video,
.archivo__vista img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.archivo__icono {
  font-size: 2rem;
}

.archivo__nombre {
  margin: 0;
  font-weight: 700;
  word-break: break-word;
}

.archivo__meta {
  margin: 0 0 8px;
  font-size: 0.85rem;
}

.archivo__pendiente {
  font-size: 0.9rem;
  color: var(--calor);
}

.archivo__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .zona {
    transition: none;
  }
}
</style>
