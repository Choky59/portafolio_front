/** What the Status pages (list and match) share: the players' colors, their device, durations */

/** The game's car colors (COLORES in the game's protocol) */
export const COLORES_JUEGO = {
  rojo: '#e4572e',
  azul: '#4f8fe8',
  amarillo: '#f6c445',
  verde: '#7fb7a4',
  morado: '#9c6ade',
  rosa: '#f07fb0',
}

export const colorJugador = (color) => COLORES_JUEGO[color] ?? '#999'

/** "App Android · celular", "Navegador · compu"… (null: an old version that doesn't say) */
export function textoDispositivo(d) {
  if (!d) return 'Dispositivo desconocido'
  const donde = d.nativo
    ? `App ${d.plataforma === 'ios' ? 'iOS' : 'Android'}`
    : `Navegador${/iPhone|iPad/.test(d.ua) ? ' iOS' : /Android/.test(d.ua) ? ' Android' : ''}`
  return `${donde} · ${d.celular ? 'celular' : 'compu'}`
}

export const iconoDispositivo = (d) => (!d ? '❔' : d.celular ? '📱' : '💻')

export function duracion(desde, hasta = Date.now()) {
  const s = Math.max(0, Math.round((hasta - desde) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h} h ${m} min` : m ? `${m} min ${s % 60} s` : `${s} s`
}

/** The worst of a player's flags: 'malo', 'ojo' or 'bien' */
export function peorNivel(banderas = []) {
  if (banderas.some((b) => b.nivel === 'malo')) return 'malo'
  if (banderas.some((b) => b.nivel === 'ojo')) return 'ojo'
  return 'bien'
}

export const NOMBRES_BANDERA = {
  render: 'Render',
  bajada: 'Bajada',
  subida: 'Subida',
  rtt: 'Ping',
  prediccion: 'Predicción',
  brincos: 'Brincos',
  servidor: 'Servidor',
  sinDatos: 'Sin datos',
}
