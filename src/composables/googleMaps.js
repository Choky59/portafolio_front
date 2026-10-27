/**
 * Loads the Google Maps JavaScript API once (with the marker library) and resolves to
 * `google.maps`. The key is public by design: restrict it in Google Cloud to this site's
 * domains (HTTP referrers) and to the Maps JavaScript API.
 *
 *   VITE_GOOGLE_MAPS_KEY      API key (required)
 *   VITE_GOOGLE_MAPS_MAP_ID   Map ID (optional): Advanced Markers need one. Without it the
 *                             map uses DEMO_MAP_ID, which Google allows for testing.
 */
export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
export const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

const CALLBACK = '__pulsoGoogleMaps'
let cargando = null

/**
 * Google calls window.gm_authFailure when it rejects the key (a domain not allowed, the
 * API not enabled, no billing...). The exact reason is only in the browser console.
 */
const alFallar = new Set()
let fallo = false
export const ERROR_LLAVE =
  'Google Maps rechazó la llave de este sitio. Revisa en Google Cloud que la llave permita este dominio y la Maps JavaScript API (el motivo exacto está en la consola del navegador).'

/** Runs fn if the key is rejected (now or later); returns a function that stops listening */
export function siFallaLaLlave(fn) {
  if (fallo) fn()
  alFallar.add(fn)
  return () => alFallar.delete(fn)
}

export function cargarGoogleMaps() {
  if (window.google?.maps?.marker) return Promise.resolve(window.google.maps)
  if (cargando) return cargando
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('Falta la llave de Google Maps (VITE_GOOGLE_MAPS_KEY).'))

  window.gm_authFailure = () => {
    fallo = true
    for (const fn of alFallar) fn()
  }

  cargando = new Promise((resolve, reject) => {
    window[CALLBACK] = () => {
      delete window[CALLBACK]
      resolve(window.google.maps)
    }
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      v: 'weekly',
      libraries: 'marker',
      language: 'es',
      region: 'MX',
      loading: 'async',
      callback: CALLBACK,
    })
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    script.onerror = () => {
      cargando = null
      script.remove()
      reject(new Error('No se pudo cargar Google Maps.'))
    }
    document.head.appendChild(script)
  })
  return cargando
}
