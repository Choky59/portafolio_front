import { computed, ref } from 'vue'
import { noticiasDemo } from '../data/pulsoDemo'
import { getMultitud } from '../api/pulso'
import { nombreTema } from '../components/analisis/pulso/catalogo'

/**
 * News for "El pulso de Hermosillo" and the selected one.
 * The crowd shows the latest analyzed news (GET /pulso/multitud). Until there are some
 * (or if the API fails) it shows the fictional examples, labeled as such.
 */

function mezclaMultitud(n) {
  const intensidad = Math.min(1, Math.max(0, n.intensidad ?? 0.5))
  const mezcla = Object.fromEntries(Object.entries(n.emociones ?? {}).map(([e, v]) => [e, Math.round(v * intensidad * 1000) / 1000]))
  mezcla.neutral = Math.round((1 - intensidad) * 1000) / 1000
  return mezcla
}

/** A real analyzed note in the shape the crowd and its panel use (same as the examples) */
function aMultitud(n) {
  return {
    id: n.id,
    titulo: n.titulo,
    resumen: n.resumen,
    fuente: { tipo: n.fuente.tipo, nombre: n.fuente.nombre },
    fecha: n.fecha,
    categoria: nombreTema(n.tema),
    tags: n.etiquetas,
    entidades: [
      ...n.actores.map((a) => ({
        tipo: a.tipo === 'persona' || a.tipo === 'funcionario' ? 'persona' : 'organizacion',
        nombre: a.nombre,
        rol: a.rol.replace('_', ' '),
      })),
      ...n.lugares.map((l) => ({ tipo: 'lugar', nombre: l, rol: 'lugar' })),
    ],
    // A share `intensidad` of the people react with the note's mix; the rest don't react (neutral)
    sentimiento: { emociones: mezclaMultitud(n), polaridad: n.polaridad, intensidad: n.intensidad },
    emocionDominante: n.emocionDominante,
    relevancia: n.relevancia,
    enlace: n.enlace,
  }
}

const POR_PAGINA = 40

export function usePulso() {
  const noticias = ref(noticiasDemo)
  const esDemo = ref(true)

  getMultitud(undefined, POR_PAGINA)
    .then(({ noticias: reales }) => {
      if (!reales?.length) return
      noticias.value = reales.map(aMultitud)
      esDemo.value = false
    })
    .catch(() => {}) // keep the examples

  const seleccionId = ref(null)
  const seleccion = computed(() => noticias.value.find((n) => n.id === seleccionId.value) ?? null)

  /** No older news left to load (or they're the examples) */
  const agotadas = ref(false)
  const cargando = ref(false)

  /** Appends the next older page of news; resolves to how many came */
  async function cargarMas() {
    if (esDemo.value || agotadas.value || cargando.value) return 0
    cargando.value = true
    try {
      const { noticias: mas } = await getMultitud(undefined, POR_PAGINA, noticias.value.length)
      const ya = new Set(noticias.value.map((n) => n.id))
      const nuevas = (mas ?? []).filter((n) => !ya.has(n.id)).map(aMultitud)
      if (nuevas.length) noticias.value = [...noticias.value, ...nuevas]
      if ((mas?.length ?? 0) < POR_PAGINA) agotadas.value = true
      return nuevas.length
    } catch {
      return 0
    } finally {
      cargando.value = false
    }
  }

  return { noticias, esDemo, seleccionId, seleccion, agotadas, cargando, cargarMas }
}
