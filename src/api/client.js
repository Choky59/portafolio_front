const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/api`

let tokenProvider = () => null
let onUnauthorized = () => {}

/** Set by useSession so admin calls carry the `session` header */
export function setTokenProvider(fn) {
  tokenProvider = fn
}

/** Called when an authenticated call returns 401 (expired or revoked session) */
export function setOnUnauthorized(fn) {
  onUnauthorized = fn
}

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error?.message || payload?.message || `Error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.key = payload?.error?.key ?? null
    this.details = payload?.error?.data ?? null
  }
}

/**
 * fetch wrapper: JSON in/out, AbortSignal support and typed errors.
 * `auth: true` adds the admin session header.
 */
export async function api(path, { method = 'GET', body, signal, auth = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = tokenProvider()
    if (token) headers.session = token
  }

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError(0, { message: 'No se pudo conectar con el servidor' })
  }

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    if (auth && res.status === 401) onUnauthorized()
    throw new ApiError(res.status, payload)
  }

  return payload
}

/** Friendly Spanish message for any error thrown by api() */
export function mensajeError(err) {
  if (!err) return ''
  if (err.status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión.'
  if (err.key === 'INVALID_CREDENTIALS') return 'Usuario o contraseña incorrectos.'
  if (err.status === 429) return 'Demasiados intentos. Espera unos minutos.'
  if (err.status === 404) return 'No encontramos lo que buscas.'
  if (err.status === 400 && Array.isArray(err.details)) return err.details.join(' · ')
  if (err.status === 401) return 'Tu sesión expiró. Vuelve a entrar.'
  return 'Algo salió mal. Intenta de nuevo.'
}
