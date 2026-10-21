import { computed, reactive, ref } from 'vue'
import { noticiasDemo } from '../data/pulsoDemo'
import { pasaFiltro } from '../three/pulso/emociones'
import { getMultitud } from '../api/pulso'
import { nombreTema } from '../components/analisis/pulso/catalogo'

/**
 * News + filters for "El pulso de Hermosillo".
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

export function usePulso() {
  const noticias = ref(noticiasDemo)
  const esDemo = ref(true)

  getMultitud()
    .then(({ noticias: reales }) => {
      if (!reales?.length) return
      noticias.value = reales.map(aMultitud)
      esDemo.value = false
    })
    .catch(() => {}) // keep the examples

  const filtro = reactive({ emocion: '', fuente: '', categoria: '' })
  const seleccionId = ref(null)

  const categorias = computed(() => [...new Set(noticias.value.map((n) => n.categoria))].sort())
  const visibles = computed(() => noticias.value.filter((n) => pasaFiltro(n, filtro)))
  const seleccion = computed(() => noticias.value.find((n) => n.id === seleccionId.value) ?? null)
  const hayFiltro = computed(() => !!(filtro.emocion || filtro.fuente || filtro.categoria))

  function limpiarFiltro() {
    filtro.emocion = ''
    filtro.fuente = ''
    filtro.categoria = ''
  }

  return { noticias, esDemo, filtro, seleccionId, categorias, visibles, seleccion, hayFiltro, limpiarFiltro }
}
