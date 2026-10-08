import { computed, reactive, ref } from 'vue'
import { noticiasDemo } from '../data/pulsoDemo'
import { pasaFiltro } from '../three/pulso/emociones'

/**
 * News + filters for "El pulso de Hermosillo".
 * For now the news are the fictional examples; when the API exists only
 * `noticias` changes source (src/api/noticias.js), the rest stays the same.
 */
export function usePulso() {
  const noticias = ref(noticiasDemo)
  const esDemo = true

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
