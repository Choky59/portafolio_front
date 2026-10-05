import { onBeforeUnmount, onMounted, ref } from 'vue'

/** true while `elRef` is (almost) on screen */
export function useVisible(elRef, { rootMargin = '100px', threshold = 0 } = {}) {
  const visible = ref(false)
  let observer = null

  onMounted(() => {
    if (!('IntersectionObserver' in window)) {
      visible.value = true
      return
    }
    observer = new IntersectionObserver(
      ([entry]) => {
        visible.value = entry.isIntersecting
      },
      { rootMargin, threshold }
    )
    if (elRef.value) observer.observe(elRef.value)
  })

  onBeforeUnmount(() => observer?.disconnect())

  return visible
}
