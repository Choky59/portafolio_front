<script setup>
import { computed, reactive, ref, watch } from 'vue'

import EstadoCarga from '../../components/EstadoCarga.vue'
import EstadoError from '../../components/EstadoError.vue'
import CodigoVinculacion from '../../components/admin/CodigoVinculacion.vue'

import { useApi } from '../../composables/useApi'
import { mensajeError } from '../../api/client'
import * as AdminApi from '../../api/admin'
import { listProyectos } from '../../api/proyectos'

/* Filters + list */
const filtros = reactive({ status: '', type: '' })
const { data: dispositivos, error, loading, reload } = useApi((signal) =>
  AdminApi.listDevices({ ...filtros }, signal)
)
watch(filtros, () => reload())

/* Select options */
const { data: tipos } = useApi(AdminApi.getDeviceTypes)
const { data: proyectos } = useApi(listProyectos)

/* Create */
const nuevo = reactive({ name: '', type: 'ESP32', description: '', proyecto: '' })
const creando = ref(false)
const errorCrear = ref(null)

/* Pairing code being shown (only available right after create / regenerate) */
const codigo = ref(null)

/* Per-row action feedback */
const ocupado = ref(null)
const errorAccion = ref(null)

async function crear() {
  creando.value = true
  errorCrear.value = null
  try {
    const res = await AdminApi.createDevice({
      name: nuevo.name,
      type: nuevo.type,
      description: nuevo.description || undefined,
      proyecto: nuevo.proyecto || null,
    })
    codigo.value = { nombre: res.device.name, codigo: res.claimCode, expiraEn: res.expiresAt }
    Object.assign(nuevo, { name: '', description: '' })
    reload()
  } catch (err) {
    errorCrear.value = err
  } finally {
    creando.value = false
  }
}

async function accion(device, fn) {
  ocupado.value = device.deviceId
  errorAccion.value = null
  try {
    await fn()
    reload()
  } catch (err) {
    errorAccion.value = { deviceId: device.deviceId, error: err }
  } finally {
    ocupado.value = null
  }
}

function generarCodigo(device) {
  return accion(device, async () => {
    const res = await AdminApi.newClaimCode(device.deviceId)
    codigo.value = { nombre: device.name, codigo: res.claimCode, expiraEn: res.expiresAt }
  })
}

function asignarProyecto(device, proyecto) {
  return accion(device, () => AdminApi.updateDevice(device.deviceId, { proyecto: proyecto || null }))
}

function revocar(device) {
  if (!confirm(`¿Revocar "${device.name}"? Dejará de poder enviar datos hasta que lo vuelvas a vincular.`)) return
  return accion(device, () => AdminApi.revokeDevice(device.deviceId))
}

function borrar(device) {
  if (!confirm(`¿Borrar "${device.name}"? Esta acción no se puede deshacer.`)) return
  return accion(device, () => AdminApi.deleteDevice(device.deviceId))
}

/* Formatting */
const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
const formatear = (iso) => (iso ? fecha.format(new Date(iso)) : 'Nunca')

const ETIQUETAS = { PENDING: 'Pendiente', ACTIVE: 'Activo', REVOKED: 'Revocado' }

const titulosProyecto = computed(() =>
  Object.fromEntries((proyectos.value ?? []).map((p) => [p.slug, `#${p.numero} ${p.titulo}`]))
)
</script>

<template>
  <section class="panel">
    <h2 class="panel__titulo">Sensores</h2>

    <CodigoVinculacion
      v-if="codigo"
      :key="codigo.codigo"
      :nombre="codigo.nombre"
      :codigo="codigo.codigo"
      :expira-en="codigo.expiraEn"
      class="panel__codigo"
      @cerrar="codigo = null"
    />

    <form class="panel__nuevo card" @submit.prevent="crear">
      <h3>Nuevo sensor</h3>
      <div class="panel__campos">
        <div class="field">
          <label for="n-nombre">Nombre</label>
          <input id="n-nombre" v-model.trim="nuevo.name" class="input" maxlength="80" required placeholder="Sensor patio" />
        </div>
        <div class="field">
          <label for="n-tipo">Tipo</label>
          <select id="n-tipo" v-model="nuevo.type" class="input">
            <option v-for="t in tipos ?? ['ESP32']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="field">
          <label for="n-proyecto">Proyecto</label>
          <select id="n-proyecto" v-model="nuevo.proyecto" class="input">
            <option value="">Sin asignar</option>
            <option v-for="p in proyectos ?? []" :key="p.slug" :value="p.slug">#{{ p.numero }} {{ p.titulo }}</option>
          </select>
        </div>
        <div class="field">
          <label for="n-desc">Descripción (opcional)</label>
          <input id="n-desc" v-model.trim="nuevo.description" class="input" maxlength="500" />
        </div>
      </div>
      <p v-if="errorCrear" class="panel__error" role="alert">{{ mensajeError(errorCrear) }}</p>
      <button type="submit" class="btn" :disabled="creando">
        {{ creando ? 'Creando…' : 'Crear y obtener código' }}
      </button>
    </form>

    <div class="panel__filtros">
      <div class="field">
        <label for="f-estado">Estado</label>
        <select id="f-estado" v-model="filtros.status" class="input">
          <option value="">Todos</option>
          <option value="ACTIVE">Activos</option>
          <option value="PENDING">Pendientes</option>
          <option value="REVOKED">Revocados</option>
        </select>
      </div>
      <div class="field">
        <label for="f-tipo">Tipo</label>
        <select id="f-tipo" v-model="filtros.type" class="input">
          <option value="">Todos</option>
          <option v-for="t in tipos ?? []" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
    </div>

    <EstadoCarga v-if="loading && !dispositivos" texto="Cargando sensores…" />
    <EstadoError v-else-if="error" :error="error" @reintentar="reload" />
    <p v-else-if="dispositivos && !dispositivos.length" class="muted">No hay sensores con esos filtros.</p>

    <ul v-else-if="dispositivos" class="lista">
      <li v-for="d in dispositivos" :key="d.deviceId" class="sensor card" :aria-busy="ocupado === d.deviceId">
        <div class="sensor__cabecera">
          <div>
            <h3 class="sensor__nombre">{{ d.name }}</h3>
            <p class="sensor__id muted">{{ d.deviceId }}</p>
          </div>
          <span class="estado" :class="`estado--${d.status.toLowerCase()}`">{{ ETIQUETAS[d.status] }}</span>
        </div>

        <dl class="sensor__datos">
          <div><dt>Tipo</dt><dd>{{ d.type }}</dd></div>
          <div><dt>Última conexión</dt><dd>{{ formatear(d.lastSeenAt) }}</dd></div>
          <div><dt>Firmware</dt><dd>{{ d.firmwareVersion ?? '—' }}</dd></div>
          <div><dt>Hardware</dt><dd>{{ d.hardwareId ?? '—' }}</dd></div>
          <div v-if="d.hasPendingClaim"><dt>Código</dt><dd>Esperando que el sensor lo canjee</dd></div>
        </dl>

        <div class="field sensor__proyecto">
          <label :for="`p-${d.deviceId}`">Proyecto</label>
          <select
            :id="`p-${d.deviceId}`"
            class="input"
            :value="d.proyecto ?? ''"
            :disabled="ocupado === d.deviceId"
            @change="asignarProyecto(d, $event.target.value)"
          >
            <option value="">Sin asignar</option>
            <option v-for="p in proyectos ?? []" :key="p.slug" :value="p.slug">{{ titulosProyecto[p.slug] }}</option>
          </select>
        </div>

        <p v-if="errorAccion?.deviceId === d.deviceId" class="panel__error" role="alert">
          {{ mensajeError(errorAccion.error) }}
        </p>

        <div class="sensor__acciones">
          <button type="button" class="btn btn--ghost btn--sm" :disabled="ocupado === d.deviceId" @click="generarCodigo(d)">
            {{ d.status === 'ACTIVE' ? 'Revincular' : 'Nuevo código' }}
          </button>
          <button
            v-if="d.status !== 'REVOKED'"
            type="button"
            class="btn btn--danger btn--sm"
            :disabled="ocupado === d.deviceId"
            @click="revocar(d)"
          >
            Revocar
          </button>
          <button type="button" class="btn btn--danger btn--sm" :disabled="ocupado === d.deviceId" @click="borrar(d)">
            Borrar
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.panel__titulo {
  font-size: 2.2rem;
}

.panel__codigo {
  margin-bottom: 20px;
}

.panel__nuevo {
  padding: 20px;
  margin-bottom: 24px;
}

.panel__nuevo h3 {
  font-size: 1.8rem;
}

.panel__campos,
.panel__filtros {
  display: grid;
  gap: 0 14px;
}

@media (min-width: 720px) {
  .panel__campos {
    grid-template-columns: repeat(2, 1fr);
  }

  .panel__filtros {
    grid-template-columns: repeat(2, minmax(0, 220px));
  }
}

.panel__error {
  color: var(--extremo);
  font-weight: 600;
}

.lista {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 14px;
}

@media (min-width: 900px) {
  .lista {
    grid-template-columns: repeat(2, 1fr);
  }
}

.sensor {
  padding: 18px;
}

.sensor[aria-busy='true'] {
  opacity: 0.6;
}

.sensor__cabecera {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.sensor__nombre {
  font-size: 1.5rem;
  margin: 0;
}

.sensor__id {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.8rem;
  margin: 0;
}

.sensor__datos {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 14px;
  margin: 14px 0;
}

.sensor__datos dt {
  font-size: 0.75rem;
  color: var(--muted);
}

.sensor__datos dd {
  margin: 0;
  font-weight: 600;
  word-break: break-word;
}

.sensor__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.estado {
  align-self: flex-start;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid currentColor;
}

.estado--active { color: var(--ideal); }
.estado--pending { color: var(--calor); }
.estado--revoked { color: var(--extremo); }
</style>
