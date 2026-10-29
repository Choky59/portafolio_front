/**
 * Game sounds, all synthesized with WebAudio (no audio files): an engine whose pitch follows
 * the speed, tire squeal when drifting, gravel on dirt, and one-shots for explosions, items,
 * the countdown and the donkey's bray. Muting is remembered in this browser.
 *
 * Browsers only allow audio after a user gesture: call activar() from one (click, key).
 */
const GUARDADO = 'carreras:silencio'

function leerSilencio() {
  try {
    return localStorage.getItem(GUARDADO) === '1'
  } catch {
    return false
  }
}

export function crearSonido() {
  let ctx = null
  let salida = null
  let motor = null
  let silencio = leerSilencio()
  let ruido = null

  function iniciar() {
    if (ctx) return
    const Contexto = window.AudioContext || window.webkitAudioContext
    if (!Contexto) return
    ctx = new Contexto()
    salida = ctx.createGain()
    salida.gain.value = silencio ? 0 : 0.7
    salida.connect(ctx.destination)

    // White noise, reused by everything that hisses or rumbles
    ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const datos = ruido.getChannelData(0)
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1

    // Engine: two detuned saws through a low-pass, plus the tire and gravel noise beds
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.frequency.value = 600
    const volumenMotor = ctx.createGain()
    volumenMotor.gain.value = 0
    filtro.connect(volumenMotor).connect(salida)
    const osciladores = [0, 7].map((detune) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.detune.value = detune
      o.frequency.value = 50
      o.connect(filtro)
      o.start()
      return o
    })
    const chillido = cama('bandpass', 1500, 6)
    const grava = cama('lowpass', 400, 0.7)
    motor = { osciladores, filtro, volumenMotor, chillido, grava }
  }

  /** A looping noise through a filter, volume 0 until used */
  function cama(tipo, frecuencia, q) {
    const fuente = ctx.createBufferSource()
    fuente.buffer = ruido
    fuente.loop = true
    const filtro = ctx.createBiquadFilter()
    filtro.type = tipo
    filtro.frequency.value = frecuencia
    filtro.Q.value = q
    const volumen = ctx.createGain()
    volumen.gain.value = 0
    fuente.connect(filtro).connect(volumen).connect(salida)
    fuente.start()
    return volumen
  }

  /** A short tone with an attack/decay envelope */
  function tono(frecuencia, { tipo = 'square', inicio = 0, duracion = 0.15, volumen = 0.15, hasta } = {}) {
    if (!ctx) return
    const t = ctx.currentTime + inicio
    const o = ctx.createOscillator()
    o.type = tipo
    o.frequency.setValueAtTime(frecuencia, t)
    if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + duracion)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(volumen, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion)
    o.connect(g).connect(salida)
    o.start(t)
    o.stop(t + duracion + 0.05)
  }

  /** A burst of filtered noise */
  function soplo({ inicio = 0, duracion = 0.4, volumen = 0.4, desde = 2000, hasta = 200, tipo = 'lowpass' } = {}) {
    if (!ctx) return
    const t = ctx.currentTime + inicio
    const fuente = ctx.createBufferSource()
    fuente.buffer = ruido
    const filtro = ctx.createBiquadFilter()
    filtro.type = tipo
    filtro.frequency.setValueAtTime(desde, t)
    filtro.frequency.exponentialRampToValueAtTime(hasta, t + duracion)
    const g = ctx.createGain()
    g.gain.setValueAtTime(volumen, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion)
    fuente.connect(filtro).connect(g).connect(salida)
    fuente.start(t)
    fuente.stop(t + duracion + 0.05)
  }

  const EFECTOS = {
    explosion() {
      soplo({ duracion: 0.9, volumen: 0.8, desde: 3000, hasta: 80 })
      tono(90, { tipo: 'sine', duracion: 0.6, volumen: 0.6, hasta: 30 })
    },
    item() {
      ;[660, 880, 1320].forEach((f, i) => tono(f, { inicio: i * 0.06, duracion: 0.12, volumen: 0.08 }))
    },
    usar() {
      soplo({ duracion: 0.3, volumen: 0.25, desde: 400, hasta: 3000, tipo: 'bandpass' })
    },
    golpe() {
      tono(160, { tipo: 'triangle', duracion: 0.25, volumen: 0.35, hasta: 60 })
      soplo({ duracion: 0.15, volumen: 0.25, desde: 1500, hasta: 300 })
    },
    /** Hee-haw: the Burro percherón announces itself */
    rebuzno() {
      for (let i = 0; i < 2; i++) {
        tono(620, { tipo: 'sawtooth', inicio: i * 0.5, duracion: 0.22, volumen: 0.12, hasta: 820 })
        tono(330, { tipo: 'sawtooth', inicio: i * 0.5 + 0.22, duracion: 0.26, volumen: 0.12, hasta: 260 })
      }
    },
    cuenta() {
      tono(440, { tipo: 'sine', duracion: 0.18, volumen: 0.2 })
    },
    arranque() {
      tono(880, { tipo: 'sine', duracion: 0.4, volumen: 0.25 })
    },
    punto() {
      ;[523, 659, 784, 1047].forEach((f, i) => tono(f, { tipo: 'triangle', inicio: i * 0.09, duracion: 0.25, volumen: 0.15 }))
    },
  }

  return {
    /** Call from a user gesture */
    activar() {
      iniciar()
      ctx?.resume()
    },

    /** Every frame, with the own car: speed 0 … 1, drift 0 … 1, on dirt or not */
    motor({ velocidad = 0, derrape = 0, tierra = false, activo = true }) {
      if (!ctx || !motor) return
      const t = ctx.currentTime
      const f = 45 + velocidad * 140
      for (const o of motor.osciladores) o.frequency.setTargetAtTime(f, t, 0.05)
      motor.filtro.frequency.setTargetAtTime(300 + velocidad * 1500, t, 0.05)
      motor.volumenMotor.gain.setTargetAtTime(activo ? 0.05 + velocidad * 0.06 : 0, t, 0.1)
      motor.chillido.gain.setTargetAtTime(activo && !tierra ? Math.max(0, derrape - 0.35) * 0.12 : 0, t, 0.05)
      motor.grava.gain.setTargetAtTime(activo && tierra ? velocidad * 0.25 : 0, t, 0.08)
    },

    efecto(nombre) {
      EFECTOS[nombre]?.()
    },

    get silencio() {
      return silencio
    },

    alternarSilencio() {
      silencio = !silencio
      try {
        localStorage.setItem(GUARDADO, silencio ? '1' : '0')
      } catch {
        // Private mode: it just won't be remembered
      }
      if (salida) salida.gain.setTargetAtTime(silencio ? 0 : 0.7, ctx.currentTime, 0.05)
      return silencio
    },

    destruir() {
      ctx?.close()
      ctx = null
    },
  }
}
