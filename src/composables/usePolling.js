import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Calls `fn(signal)` now and then every `intervalo` ms.
 * - Pauses while the tab is hidden and refreshes as soon as it's visible again.
 * - Stops (and aborts the request in flight) when the component unmounts.
 */
export function usePolling(fn, intervalo = 30000) {
  let timer = null
  let activo = false
  let controller = null

  async function tick() {
    clearTimeout(timer)
    controller?.abort()
    controller = new AbortController()

    try {
      await fn(controller.signal)
    } catch {
      // fn is responsible for its own error state
    }

    if (activo && !document.hidden) {
      timer = setTimeout(tick, intervalo)
    }
  }

  function onVisibility() {
    if (document.hidden) {
      clearTimeout(timer)
    } else if (activo) {
      tick()
    }
  }

  function start() {
    if (activo) return
    activo = true
    document.addEventListener('visibilitychange', onVisibility)
    tick()
  }

  function stop() {
    activo = false
    clearTimeout(timer)
    controller?.abort()
    document.removeEventListener('visibilitychange', onVisibility)
  }

  onMounted(start)
  onBeforeUnmount(stop)

  return { start, stop, refresh: tick }
}
