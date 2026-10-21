/**
 * Spanish labels for the analysis catalog (keys come from the backend,
 * portafolio_back/src/constants/pulso.ts) and the emotion colors/labels.
 */
import { EMOCIONES as TODAS } from '../../../three/pulso/emociones'

/** The analysis has five emotions (no neutral: the crowd uses it for "no reaction") */
export const EMOCIONES = TODAS.filter((e) => e.clave !== 'neutral')
export const colorEmocion = (clave) => `var(--emo-${clave})`
export const nombreEmocion = (clave) => TODAS.find((e) => e.clave === clave)?.etiqueta ?? clave

/** 0..1 intensity of the reaction in words */
export function intensidadEnPalabras(v) {
  if (v === null || v === undefined) return ''
  if (v < 0.25) return 'reacción leve'
  if (v < 0.5) return 'reacción moderada'
  if (v < 0.75) return 'reacción fuerte'
  return 'reacción muy fuerte'
}

export const FRANJAS = { madrugada: 'de madrugada', 'mañana': 'en la mañana', tarde: 'en la tarde', noche: 'en la noche' }

/** "ocurrió el viernes de madrugada (4 h)" from tiempoLocal; '' when unknown */
export function cuandoOcurrio(t) {
  if (!t?.ocurrioFecha) return ''
  const partes = [`el ${t.ocurrioDiaSemana} ${dia(t.ocurrioFecha).replace(/^\S+\s/, '')}`]
  if (t.ocurrioFranja) partes.push(FRANJAS[t.ocurrioFranja] ?? t.ocurrioFranja)
  if (t.ocurrioHora !== null && t.ocurrioHora !== undefined) partes.push(`(${t.ocurrioHora} h)`)
  return `Ocurrió ${partes.join(' ')}`
}

/** The subtopic's detail as label / value rows (only what the note said) */
const DETALLE = {
  modalidad: 'Modalidad', vehiculos: 'Vehículos', heridos: 'Heridos', fallecidos: 'Fallecidos', gravedad: 'Gravedad',
  involucraTransportePublico: 'Transporte público', involucraPeatonCiclista: 'Peatón o ciclista',
  victimas: 'Víctimas', detenidos: 'Detenidos', arma: 'Arma', conViolencia: 'Con violencia',
  servicio: 'Servicio', falla: 'Falla', coloniasAfectadas: 'Colonias afectadas', duracionHoras: 'Duración (h)', causa: 'Causa', programado: 'Programado',
  ruta: 'Ruta', incidente: 'Incidente', afectados: 'Afectados',
  fenomeno: 'Fenómeno', temperaturaMax: 'Temperatura máx. (°C)', alerta: 'Alerta',
}
const VALORES = { leve: 'leve', leve_moderada: 'leve a moderada', grave: 'grave', energia: 'energía', agua: 'agua' }
export function filasDetalle(detalle) {
  if (!detalle) return []
  return Object.entries(detalle)
    .filter(([k, v]) => k !== 'tipo' && v !== null && v !== undefined && DETALLE[k])
    .map(([k, v]) => ({ etiqueta: DETALLE[k], valor: typeof v === 'boolean' ? (v ? 'sí' : 'no') : VALORES[v] ?? String(v) }))
}

export const TEMAS = {
  servicios_publicos: 'Servicios públicos',
  movilidad: 'Movilidad',
  seguridad: 'Seguridad',
  justicia: 'Justicia',
  salud: 'Salud',
  educacion: 'Educación',
  gobierno: 'Gobierno',
  politica: 'Política',
  economia: 'Economía',
  medio_ambiente_y_clima: 'Medio ambiente y clima',
  desarrollo_urbano: 'Desarrollo urbano',
  sociedad_y_cultura: 'Sociedad y cultura',
  otro: 'Otro',
}

/** Subtopics per topic (same catalog as the backend) */
export const SUBTEMAS = {
  servicios_publicos: ['agua', 'energia', 'recoleccion_basura', 'alumbrado', 'drenaje', 'internet_telefonia'],
  movilidad: ['transporte_urbano', 'vialidades_y_baches', 'accidentes_viales', 'transito_y_multas', 'obras_viales', 'ciclismo_y_peatones'],
  seguridad: ['homicidios', 'robos', 'violencia_familiar_y_de_genero', 'desaparecidos', 'narcotrafico_y_crimen_organizado', 'operativos_y_detenciones', 'policia'],
  justicia: ['procesos_judiciales', 'fiscalia', 'derechos_humanos', 'corrupcion'],
  salud: ['hospitales_y_servicio', 'enfermedades_y_vacunas', 'salud_mental', 'medicamentos_y_abasto', 'prevencion'],
  educacion: ['escuelas_y_calendario', 'becas_y_apoyos', 'universidades', 'docentes_y_sindicatos', 'infraestructura_escolar'],
  gobierno: ['anuncios_y_programas', 'presupuesto_y_finanzas', 'cabildo_y_congreso', 'nombramientos', 'transparencia', 'tramites'],
  politica: ['partidos', 'elecciones_y_candidatos', 'protestas_y_movimientos', 'encuestas_y_aprobacion'],
  economia: ['empleo', 'empresas_e_inversion', 'precios_y_costo_de_vida', 'mineria', 'agro_y_ganaderia', 'comercio'],
  medio_ambiente_y_clima: ['calor_y_clima', 'lluvias_e_inundaciones', 'contaminacion_y_basura', 'agua_y_sequia', 'areas_verdes', 'fauna'],
  desarrollo_urbano: ['vivienda', 'obra_publica', 'uso_de_suelo', 'colonias_irregulares', 'espacios_publicos'],
  sociedad_y_cultura: ['eventos_y_cultura', 'deportes', 'comunidad_y_tradiciones', 'migracion', 'grupos_vulnerables', 'curiosidades'],
}

/** "becas_y_apoyos" -> "Becas y apoyos" (a few need their accents) */
const ACENTOS = { energia: 'energía', recoleccion: 'recolección', telefonia: 'telefonía', vehiculos: 'vehículos', fiscalia: 'fiscalía', corrupcion: 'corrupción', tramites: 'trámites', mineria: 'minería', inversion: 'inversión', publica: 'pública', publicos: 'públicos', vias: 'vías', migracion: 'migración', transito: 'tránsito' }
export const nombreSubtema = (s) => {
  const t = String(s ?? '').split('_').map((p) => ACENTOS[p] ?? p).join(' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
export const nombreTema = (t) => TEMAS[t] ?? nombreSubtema(t)

export const TIPOS = {
  hecho: 'Hecho', anuncio_oficial: 'Anuncio oficial', denuncia_ciudadana: 'Denuncia ciudadana', entrevista: 'Entrevista',
  opinion: 'Opinión', debate: 'Debate', boletin: 'Boletín', otro: 'Otro',
}
export const AMBITOS = { local: 'Local', estatal: 'Estatal', nacional: 'Nacional', internacional: 'Internacional' }
export const TONOS = { informativo: 'Informativo', critico: 'Crítico', favorable: 'Favorable', alarmista: 'Alarmista', sensacionalista: 'Sensacionalista', humano: 'Humano' }
export const NIVELES = { municipal: 'Municipal', estatal: 'Estatal', federal: 'Federal' }

const fmtFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Hermosillo' })
const fmtDia = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
export const fecha = (iso) => (iso ? fmtFecha.format(new Date(iso)) : '')
/** "2026-10-20" (already a Hermosillo day) */
export const dia = (ymd) => fmtDia.format(new Date(`${ymd}T12:00:00Z`))

/** 93 -> "1:33", 3725 -> "1:02:05" */
export function minuto(segundos) {
  if (segundos === null || segundos === undefined) return ''
  const s = Math.floor(segundos)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/** -1..1 tone in words */
export function tonoEnPalabras(v) {
  if (v === null || v === undefined) return 'sin datos'
  if (v <= -0.5) return 'muy crítico'
  if (v <= -0.15) return 'crítico'
  if (v < 0.15) return 'neutral'
  if (v < 0.5) return 'favorable'
  return 'muy favorable'
}

/** { alegria: 3, enojo: 1 } -> segments in the catalog order, for BarraApilada */
export const segmentosEmocion = (conteo) =>
  EMOCIONES.map((e) => ({ clave: e.clave, etiqueta: e.etiqueta, valor: conteo?.[e.clave] ?? 0, color: colorEmocion(e.clave) })).filter((s) => s.valor > 0)
