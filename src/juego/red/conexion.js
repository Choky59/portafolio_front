import { io } from 'socket.io-client'

/**
 * Connection to the game server (Socket.IO namespace /juego, on the same backend as the API).
 * In dev VITE_API_URL is empty and Vite proxies /socket.io to the backend.
 *
 * To try the game as if the server were far away (page URL):
 *   ?lag=150      round trip in ms, half each way
 *   &jitter=40    plus up to this many ms at random per message, without reordering them
 *                 (TCP never reorders, so neither does the simulation)
 */
export function crearConexion({ lag = 0, jitter = 0 } = {}) {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
  const socket = io(`${base}/juego`, { transports: ['websocket'], reconnection: false })

  /**
   * One delayed lane per direction: a FIFO drained by a single timer. (One setTimeout per
   * message would reorder close messages, because browsers round timer delays.)
   */
  function carril() {
    const cola = []
    let ultima = 0
    let temporizador = null
    function vaciar() {
      temporizador = null
      while (cola.length && cola[0].cuando <= performance.now()) cola.shift().fn()
      if (cola.length) temporizador = setTimeout(vaciar, cola[0].cuando - performance.now())
    }
    return (fn) => {
      if (lag <= 0 && jitter <= 0) return fn()
      ultima = Math.max(performance.now() + lag / 2 + Math.random() * jitter, ultima)
      cola.push({ cuando: ultima, fn })
      if (!temporizador) temporizador = setTimeout(vaciar, ultima - performance.now())
    }
  }
  const salida = carril()
  const entrada = carril()

  return {
    get id() {
      return socket.id
    },

    /** Resolves once connected, rejects if the server can't be reached */
    abierta() {
      if (socket.connected) return Promise.resolve()
      return new Promise((ok, mal) => {
        socket.once('connect', ok)
        socket.once('connect_error', () => mal(new Error('No se pudo conectar con el servidor del juego')))
      })
    },

    emitir(evento, datos) {
      salida(() => socket.emit(evento, datos))
    },

    /** Request with an answer (ack), with a timeout */
    pedir(evento, datos, espera = 8000) {
      return new Promise((ok, mal) => {
        salida(() =>
          socket.timeout(espera).emit(evento, datos, (err, respuesta) => {
            if (err) mal(new Error('El servidor no respondió'))
            else entrada(() => ok(respuesta))
          }),
        )
      })
    },

    /** Round trip in ms of an empty request (null if it timed out) */
    medirPing(evento) {
      const inicio = performance.now()
      return new Promise((ok) => {
        salida(() =>
          socket.timeout(3000).emit(evento, (err) => entrada(() => ok(err ? null : performance.now() - inicio))),
        )
      })
    },

    /** Listens to an event; returns the function that stops listening */
    escuchar(evento, fn) {
      const conRetraso = (...args) => entrada(() => fn(...args))
      socket.on(evento, conRetraso)
      return () => socket.off(evento, conRetraso)
    },

    alCerrarse(fn) {
      socket.on('disconnect', fn)
    },

    cerrar() {
      socket.removeAllListeners()
      socket.disconnect()
    },
  }
}
