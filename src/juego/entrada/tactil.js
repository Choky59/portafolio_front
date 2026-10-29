/**
 * Touch controls (the phone): an input source like the keyboard (`leer()` → { giro, acel, freno,
 * mano, item }), filled in by the on-screen controller (MandoTactil.vue). It serves the phone used
 * as a remote (modo local) and the game played on the phone.
 *
 * The car goes on its own: always on the gas, except while braking (and braking when stopped
 * backs up). With one thumb on the wheel, there's only one button left to think about.
 */
/** Nothing pressed (a mando that's switched off reads like this: the car doesn't go on its own) */
const QUIETO = { giro: 0, acel: 0, freno: 0, mano: false, item: false }

/** `activo`: switched off it reads as nothing pressed (the game on a computer, until it goes phone-style) */
export function crearMando({ activo = true } = {}) {
  const estado = { activo, giro: 0, freno: false, itemApretado: false, itemPendiente: false }

  return {
    estado,
    leer() {
      if (!estado.activo) return QUIETO
      // The item is a tap: remembered until the next read, or a tap shorter than a tick is lost
      const item = estado.itemApretado || estado.itemPendiente
      estado.itemPendiente = false
      return { giro: estado.giro, acel: estado.freno ? 0 : 1, freno: estado.freno ? 1 : 0, mano: false, item }
    },
    soltarTodo() {
      Object.assign(estado, { giro: 0, freno: false, itemApretado: false, itemPendiente: false })
    },
    destruir() {
      this.soltarTodo()
    },
  }
}

/**
 * Tilt steering: the phone is the steering wheel. Turning it (around the axis that comes out of
 * the screen) steers left and right; only `giro` is touched, the buttons stay the same.
 *
 * It reads the gravity the phone measures (devicemotion), not a raw gyroscope: gravity doesn't
 * drift. The steering is the angle of gravity on the screen's plane MINUS the angle when it was
 * centered (when turned on, or with `centrar()`), so it doesn't matter how the phone is held
 * (landscape either way, upright or leaning back) nor that iPhone reports gravity with the
 * opposite sign: flipping a vector doesn't change how much it turned.
 */
const GIRO_MAXIMO = (28 * Math.PI) / 180
const ZONA_MUERTA_INCLINAR = (3 * Math.PI) / 180
/** Smoothing of the readings (0 … 1, how much of each new one counts) */
const SUAVIZADO = 0.35

export function crearInclinacion(mando) {
  let centro = null
  let angulo = null
  let escuchando = false
  let ultimaLectura = 0

  function alMoverse(e) {
    const g = e.accelerationIncludingGravity
    if (!g || g.x == null || g.y == null) return
    // Held almost flat, gravity barely touches the screen's plane: the angle would be noise
    if (Math.hypot(g.x, g.y) < 2.5) return
    ultimaLectura = performance.now()
    const medido = Math.atan2(g.y, g.x)
    angulo = angulo === null ? medido : angulo + diferencia(medido, angulo) * SUAVIZADO
    if (centro === null) centro = angulo
    const d = diferencia(angulo, centro)
    const fuera = Math.max(0, Math.abs(d) - ZONA_MUERTA_INCLINAR)
    mando.estado.giro = Math.max(-1, Math.min(1, (Math.sign(d) * fuera) / (GIRO_MAXIMO - ZONA_MUERTA_INCLINAR)))
  }

  return {
    /** Does this browser know about motion sensors at all? (a computer may say yes and never send any) */
    get disponible() {
      return typeof window !== 'undefined' && 'DeviceMotionEvent' in window
    },
    /** Did a reading arrive lately? */
    get recibiendo() {
      return performance.now() - ultimaLectura < 1000
    },
    /**
     * Turns it on. On iPhone it has to be called right on a tap (it asks for permission).
     * Resolves true if allowed (readings may still never come: check `recibiendo` a moment later).
     */
    async activar() {
      if (!this.disponible) return false
      const pedir = window.DeviceMotionEvent.requestPermission
      if (typeof pedir === 'function') {
        try {
          if ((await pedir.call(window.DeviceMotionEvent)) !== 'granted') return false
        } catch {
          return false
        }
      }
      centro = null
      angulo = null
      if (!escuchando) window.addEventListener('devicemotion', alMoverse)
      escuchando = true
      return true
    },
    /** The current position becomes "straight" */
    centrar() {
      centro = angulo
      mando.estado.giro = 0
    },
    detener() {
      if (escuchando) window.removeEventListener('devicemotion', alMoverse)
      escuchando = false
      mando.estado.giro = 0
    },
  }
}

/** a - b, the short way around */
function diferencia(a, b) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
