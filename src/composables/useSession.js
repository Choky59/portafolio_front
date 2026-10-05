import { computed, reactive } from 'vue'
import { setTokenProvider } from '../api/client'
import * as AdminApi from '../api/admin'

const KEY = 'portafolio.session'

function leerToken() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

const state = reactive({
  token: leerToken(),
  user: null,
})

setTokenProvider(() => state.token)

function guardar(token) {
  state.token = token
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch {
    // ignore storage errors
  }
}

export function limpiarSesion() {
  guardar(null)
  state.user = null
}

export function useSession() {
  async function iniciar({ username, password, expiration = 1 }) {
    const res = await AdminApi.login({ username, password, expiration })
    guardar(res.session.token)
    state.user = res.user
    return res.user
  }

  async function cerrar() {
    try {
      await AdminApi.logout()
    } catch {
      // the session may already be gone; clear it locally anyway
    }
    limpiarSesion()
  }

  /** true if there's a valid session (validates the stored token once) */
  async function asegurar() {
    if (!state.token) return false
    if (state.user) return true
    try {
      state.user = await AdminApi.me()
      return true
    } catch {
      limpiarSesion()
      return false
    }
  }

  return {
    usuario: computed(() => state.user),
    autenticado: computed(() => !!state.token && !!state.user),
    iniciar,
    cerrar,
    asegurar,
  }
}
