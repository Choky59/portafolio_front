import { onBeforeUnmount, ref } from 'vue'

/** Reactive matchMedia, e.g. useMediaQuery('(min-width: 720px)') */
export function useMediaQuery(query) {
  const mql = window.matchMedia(query)
  const coincide = ref(mql.matches)
  const onChange = (e) => (coincide.value = e.matches)

  mql.addEventListener('change', onChange)
  onBeforeUnmount(() => mql.removeEventListener('change', onChange))

  return coincide
}
