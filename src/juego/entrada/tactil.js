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
 * Tilt steering, like carrying a box of water: the phone in landscape (lying back on the table,
 * lifted ~35°, or upright: it doesn't matter), and you lower one end to steer that way. Lower the
 * right end, the car turns right. Only `giro` is touched, the buttons stay the same.
 *
 * It reads the gravity the phone measures (devicemotion), not a raw gyroscope: gravity doesn't
 * drift. The tilt is how much of gravity goes along the screen's left-right axis, over all of it
 * (asin): the angle by which that axis is off level, whatever the angle toward you. Level is
 * straight; `centrar()` makes the current tilt straight instead.
 *
 * Two things change the signs and are handled here: which way the phone is turned (the screen's
 * left-right axis is the phone's long axis, one way or the other: screen.orientation), and that
 * iPhone has reported gravity with the opposite sign to the standard (Android): while the screen
 * faces up the reading along it must be positive, so that's used to tell, with the platform as a
 * guess when the phone is upright.
 */
const GIRO_MAXIMO = (25 * Math.PI) / 180
const ZONA_MUERTA_INCLINAR = (3 * Math.PI) / 180
/** Smoothing of the readings (0 … 1, how much of each new one counts) */
const SUAVIZADO = 0.35

export function crearInclinacion(mando) {
  /** The tilt that counts as straight (0: level) */
  let centro = 0
  let angulo = null
  let escuchando = false
  let ultimaLectura = 0
  /** +1 if readings follow the standard, -1 if flipped (old iPhones); decided while facing up */
  let signo = typeof window !== 'undefined' && typeof window.DeviceMotionEvent?.requestPermission === 'function' ? -1 : 1

  function alMoverse(e) {
    const g = e.accelerationIncludingGravity
    if (!g || g.x == null || g.y == null) return
    const z = g.z ?? 0
    const total = Math.hypot(g.x, g.y, z)
    if (total < 4) return // a jolt, not gravity
    ultimaLectura = performance.now()
    // Screen clearly facing up: its reading tells the sign convention
    if (Math.abs(z) > total * 0.5) signo = Math.sign(z)
    const giroPantalla = ((screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180
    // Reading along the screen's left → right axis (the device's axes are those of portrait)
    const derecha = (signo * (g.x * Math.cos(giroPantalla) - g.y * Math.sin(giroPantalla))) / total
    // How much the right end is raised (radians)
    const medido = Math.asin(Math.max(-1, Math.min(1, derecha)))
    angulo = angulo === null ? medido : angulo + (medido - angulo) * SUAVIZADO
    // Right end down (negative) → turn right
    const d = centro - angulo
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
      angulo = null
      if (!escuchando) window.addEventListener('devicemotion', alMoverse)
      escuchando = true
      return true
    },
    /** The current tilt becomes "straight" (by default, level is) */
    centrar() {
      if (angulo !== null) centro = angulo
      mando.estado.giro = 0
    },
    detener() {
      if (escuchando) window.removeEventListener('devicemotion', alMoverse)
      escuchando = false
      mando.estado.giro = 0
    },
  }
}
