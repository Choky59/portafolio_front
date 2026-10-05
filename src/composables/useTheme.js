import { computed, ref } from 'vue'

const KEY = 'portafolio.tema'

function leer() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const query = window.matchMedia('(prefers-color-scheme: light)')
const sistemaClaro = ref(query.matches)
query.addEventListener('change', (e) => {
  sistemaClaro.value = e.matches
})

const preferencia = ref(leer())
const temaEfectivo = computed(() =>
  preferencia.value === 'system' ? (sistemaClaro.value ? 'light' : 'dark') : preferencia.value
)

function aplicar() {
  const root = document.documentElement
  if (preferencia.value === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', preferencia.value)

  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    temaEfectivo.value === 'light' ? '#F1E6CC' : '#22170F'
  )
}

aplicar()

export function useTheme() {
  function alternar() {
    preferencia.value = temaEfectivo.value === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(KEY, preferencia.value)
    } catch {
      // private mode: theme just won't be remembered
    }
    aplicar()
  }

  return { temaEfectivo, alternar }
}
