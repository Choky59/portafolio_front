import { getCurrentInstance, onBeforeUnmount, ref, shallowRef } from 'vue'

/**
 * Loading / error / data state for one API call.
 * `fetcher(signal)` gets an AbortSignal; a new reload() aborts the previous one,
 * and leaving the component aborts whatever is in flight.
 */
export function useApi(fetcher, { immediate = true } = {}) {
  const data = shallowRef(null)
  const error = ref(null)
  const loading = ref(false)
  let controller = null

  async function reload() {
    controller?.abort()
    const current = (controller = new AbortController())
    loading.value = true
    error.value = null

    try {
      const result = await fetcher(current.signal)
      if (!current.signal.aborted) data.value = result
    } catch (err) {
      if (err?.name !== 'AbortError' && !current.signal.aborted) error.value = err
    } finally {
      if (current === controller) loading.value = false
    }
  }

  if (getCurrentInstance()) onBeforeUnmount(() => controller?.abort())
  if (immediate) reload()

  return { data, error, loading, reload }
}
