import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Shared behavior of the SVG charts:
 * - measures the real width of `contenedor` (ResizeObserver) so charts draw in real pixels
 *   and their text keeps a readable size on phones;
 * - hover / touch / keyboard selection of the nearest point (`activo` = index or null).
 *
 * cantidad():  how many points there are
 * posicionX(i): x in px of point i
 * margen:      { left, right } of the plot area (pointer outside it clears the selection)
 */
export function useGraficaInteractiva({ cantidad, posicionX, margen, anchoMinimo = 260 }) {
  const contenedor = ref(null)
  const svg = ref(null)
  const ancho = ref(600)
  const activo = ref(null)
  let observer = null

  onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
      ancho.value = Math.max(anchoMinimo, Math.round(entry.contentRect.width))
    })
    observer.observe(contenedor.value)
  })
  onBeforeUnmount(() => observer?.disconnect())

  function masCercano(px) {
    let mejor = null
    let distancia = Infinity
    for (let i = 0; i < cantidad(); i++) {
      const dx = Math.abs(posicionX(i) - px)
      if (dx < distancia) {
        distancia = dx
        mejor = i
      }
    }
    return mejor
  }

  function onPointer(e) {
    if (!cantidad() || !svg.value) return
    const px = e.clientX - svg.value.getBoundingClientRect().left
    // Only inside the plot area
    if (px < margen.left - 8 || px > ancho.value - margen.right + 8) {
      activo.value = null
      return
    }
    activo.value = masCercano(px)
  }

  function onTeclado(e) {
    const n = cantidad()
    if (!n) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const paso = e.key === 'ArrowLeft' ? -1 : 1
      activo.value = activo.value === null ? n - 1 : Math.min(n - 1, Math.max(0, activo.value + paso))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      activo.value = e.key === 'Home' ? 0 : n - 1
    } else if (e.key === 'Escape') {
      activo.value = null
    }
  }

  const salir = () => (activo.value = null)

  return { contenedor, svg, ancho, activo, onPointer, onTeclado, salir }
}
