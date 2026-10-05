import { ref } from 'vue'

// Shared by every component: one media query listener for the whole app
const query = window.matchMedia('(prefers-reduced-motion: reduce)')
const reduced = ref(query.matches)
query.addEventListener('change', (e) => {
  reduced.value = e.matches
})

export function useReducedMotion() {
  return reduced
}
