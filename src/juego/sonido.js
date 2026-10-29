/**
 * Game sounds, all synthesized with WebAudio (no audio files).
 *
 * - Own engine: three layers (fundamental, sub rumble, harmonic) through a distortion for
 *   growl, a tremolo for the pistons and a filter that opens with RPM and throttle. RPM follows
 *   a 5-gear box: it climbs with speed and drops on each upshift. Wheelspin revs it up.
 * - The other cars' engines: simpler voices, quieter with distance and panned left/right.
 * - Tires: squeal when drifting on asphalt, gravel crunch on dirt. Desert wind underneath.
 * - One-shots (explosions, crashes, items, countdown…) placed where they happen: volume by
 *   distance to the camera and stereo by which side of the screen they're on.
 *
 * Browsers only allow audio after a user gesture: call activar() from one (click, key).
 * Muting is remembered in this browser.
 */
const GUARDADO = 'carreras:silencio'
const GUARDADO_AJUSTES = 'carreras:sonido'

/**
 * Sound settings (the "Sonido" panel), remembered in this browser. Volumes are per channel
 * (each one is a gain node all its sounds go through); `tono` and `grunido` shape the own engine.
 */
export const AJUSTES_SONIDO = {
  general: 0.3,
  motor: 0.35,
  otros: 0.3,
  llantas: 1,
  golpes: 1,
  items: 1,
  avisos: 1,
  ambiente: 1,
  /** Engine pitch multiplier */
  tono: 1,
  /** Engine distortion (soft clipping amount) */
  grunido: 14,
}

/** Volume channels, in panel order */
export const CANALES = ['motor', 'otros', 'llantas', 'golpes', 'items', 'avisos', 'ambiente']

/** Which channel each one-shot goes through */
const CANAL_DE = {
  explosion: 'golpes',
  choque: 'golpes',
  coletazo: 'golpes',
  muro: 'golpes',
  golpe: 'golpes',
  salpicada: 'golpes',
  item: 'items',
  usar: 'items',
  rebuzno: 'items',
  bache: 'items',
  charco: 'items',
  calor: 'items',
  humo: 'items',
  tope: 'items',
  coyotas: 'items',
  claxon: 'items',
  cambio: 'motor',
  eliminado: 'avisos',
  cuenta: 'avisos',
  arranque: 'avisos',
  punto: 'avisos',
  victoria: 'avisos',
  derrota: 'avisos',
}

/** A sample to play when a channel's slider is released */
const MUESTRA = { golpes: 'choque', items: 'rebuzno', avisos: 'punto' }

function leerAjustes() {
  try {
    return { ...AJUSTES_SONIDO, ...JSON.parse(localStorage.getItem(GUARDADO_AJUSTES) ?? '{}') }
  } catch {
    return { ...AJUSTES_SONIDO }
  }
}
/** Gear changes, as fractions of top speed */
const MARCHAS = [0, 0.16, 0.34, 0.54, 0.76, 1.05]
/** Beyond this distance (m) a sound is at its quietest */
const ALCANCE = 160

function leerSilencio() {
  try {
    return localStorage.getItem(GUARDADO) === '1'
  } catch {
    return false
  }
}

/** Engine RPM (0 … 1) and gear for a speed (fraction of top speed) */
export function rpmDe(velocidad) {
  const v = Math.max(0, velocidad)
  let marcha = 0
  while (marcha < MARCHAS.length - 2 && v >= MARCHAS[marcha + 1]) marcha++
  const tramo = (v - MARCHAS[marcha]) / (MARCHAS[marcha + 1] - MARCHAS[marcha])
  // First gear starts at idle; the rest start a bit above it (the RPM drop after shifting)
  const desde = marcha === 0 ? 0.18 : 0.42
  return { rpm: desde + (0.95 - desde) * Math.min(1, tramo), marcha }
}

export function crearSonido() {
  let ctx = null
  let maestro = null
  let ruido = null
  let propio = null
  let llantas = null
  let silencio = leerSilencio()
  const ajustes = leerAjustes()
  /** One gain node per channel, all into `maestro` */
  const buses = {}
  let marchaAnterior = 0
  /** Where the sound is heard from: the camera (x, y, heading) */
  const oyente = { x: 0, y: 0, rumbo: 0 }
  /** Other cars' engines: id → voice */
  const voces = new Map()

  function iniciar() {
    if (ctx) return
    const Contexto = window.AudioContext || window.webkitAudioContext
    if (!Contexto) return
    ctx = new Contexto()
    // Everything goes through a compressor so crashes on top of the engine don't clip
    const compresor = ctx.createDynamicsCompressor()
    compresor.threshold.value = -14
    compresor.ratio.value = 4
    maestro = ctx.createGain()
    maestro.gain.value = silencio ? 0 : ajustes.general
    maestro.connect(compresor).connect(ctx.destination)
    for (const canal of CANALES) {
      buses[canal] = ctx.createGain()
      buses[canal].gain.value = ajustes[canal]
      buses[canal].connect(maestro)
    }

    // White noise, reused by everything that hisses, rumbles or crunches
    ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const datos = ruido.getChannelData(0)
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1

    propio = crearMotor(true, buses.motor)
    llantas = {
      chillido: cama('bandpass', 1400, 9, buses.llantas),
      chillidoAlto: cama('bandpass', 2700, 12, buses.llantas),
      grava: cama('lowpass', 520, 0.8, buses.llantas),
    }
    // Desert wind, barely there, slowly breathing
    const viento = cama('lowpass', 320, 0.6, buses.ambiente)
    viento.volumen.gain.value = 0.02
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.08
    const profundidad = ctx.createGain()
    profundidad.gain.value = 140
    lfo.connect(profundidad).connect(viento.filtro.frequency)
    lfo.start()
  }

  /** A soft-clipping curve: rounds the saw waves into a growl */
  function curvaDistorsion(k) {
    const n = 1024
    const curva = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      curva[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
    }
    return curva
  }

  /** An engine voice into `bus`: `completo` (own car: three layers, more growl) or simple (other cars) */
  function crearMotor(completo, bus) {
    const salida = ctx.createGain()
    salida.gain.value = 0
    const paneo = ctx.createStereoPanner()
    salida.connect(paneo).connect(bus)

    const filtro = ctx.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.Q.value = 2.5
    const pistones = ctx.createGain()
    pistones.gain.value = 1
    const distorsion = ctx.createWaveShaper()
    distorsion.curve = curvaDistorsion(completo ? ajustes.grunido : 6)
    const mezcla = ctx.createGain()
    mezcla.gain.value = 0.5
    mezcla.connect(distorsion).connect(filtro).connect(pistones).connect(salida)

    const capas = [
      { tipo: 'sawtooth', multiplo: 1, volumen: 0.6 },
      { tipo: 'square', multiplo: 0.5, volumen: 0.45 },
      ...(completo ? [{ tipo: 'sawtooth', multiplo: 2, volumen: 0.2, detune: 9 }] : []),
    ].map((c) => {
      const o = ctx.createOscillator()
      o.type = c.tipo
      o.detune.value = c.detune ?? 0
      const g = ctx.createGain()
      g.gain.value = c.volumen
      o.connect(g).connect(mezcla)
      o.start()
      return { o, multiplo: c.multiplo }
    })

    // Pistons: a fast tremolo, stronger at low RPM (the "brrr" of idle)
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    const profundidad = ctx.createGain()
    lfo.connect(profundidad).connect(pistones.gain)
    lfo.start()

    return {
      salida,
      paneo,
      distorsion,
      /** rpm 0 … 1, carga (throttle) 0 … 1, volumen 0 … 1 */
      poner(rpm, carga, volumen, pan = 0) {
        const t = ctx.currentTime
        const f = (34 + rpm * 165) * ajustes.tono
        for (const c of capas) c.o.frequency.setTargetAtTime(f * c.multiplo, t, 0.03)
        filtro.frequency.setTargetAtTime(280 + rpm * 1900 + carga * 900, t, 0.04)
        lfo.frequency.setTargetAtTime(9 + rpm * 30, t, 0.05)
        profundidad.gain.setTargetAtTime(Math.max(0.05, 0.4 - rpm * 0.32), t, 0.05)
        salida.gain.setTargetAtTime(volumen * (0.045 + carga * 0.05 + rpm * 0.05), t, 0.06)
        paneo.pan.setTargetAtTime(pan, t, 0.05)
      },
      apagar() {
        salida.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
      },
      destruir() {
        for (const c of capas) c.o.stop()
        lfo.stop()
        paneo.disconnect()
      },
    }
  }

  /** A looping noise through a filter, volume 0 until used */
  function cama(tipo, frecuencia, q, destino) {
    const fuente = ctx.createBufferSource()
    fuente.buffer = ruido
    fuente.loop = true
    const filtro = ctx.createBiquadFilter()
    filtro.type = tipo
    filtro.frequency.value = frecuencia
    filtro.Q.value = q
    const volumen = ctx.createGain()
    volumen.gain.value = 0
    fuente.connect(filtro).connect(volumen).connect(destino)
    fuente.start()
    return { filtro, volumen }
  }

  /** Volume and pan of something happening at (x, y), heard from the camera */
  function lugar(pos) {
    if (!pos) return { volumen: 1, pan: 0 }
    const dx = pos.x - oyente.x
    const dy = pos.y - oyente.y
    const d = Math.hypot(dx, dy)
    // Right of the camera's heading is +pan
    const lateral = -dx * Math.sin(oyente.rumbo) + dy * Math.cos(oyente.rumbo)
    return {
      volumen: Math.max(0.12, 1 - d / ALCANCE),
      pan: Math.max(-0.8, Math.min(0.8, lateral / 40)),
    }
  }

  /** Output node for a one-shot: its own gain and pan, into its channel */
  function destino(pos, canal = 'golpes') {
    const { volumen, pan } = lugar(pos)
    const g = ctx.createGain()
    g.gain.value = volumen
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    g.connect(p).connect(buses[canal])
    setTimeout(() => p.disconnect(), 3000)
    return g
  }

  /** A short tone with an attack/decay envelope */
  function tono(salida, frecuencia, { tipo = 'square', inicio = 0, duracion = 0.15, volumen = 0.15, hasta } = {}) {
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
  function soplo(salida, { inicio = 0, duracion = 0.4, volumen = 0.4, desde = 2000, hasta = 200, tipo = 'lowpass', q = 1 } = {}) {
    const t = ctx.currentTime + inicio
    const fuente = ctx.createBufferSource()
    fuente.buffer = ruido
    fuente.playbackRate.value = 0.8 + Math.random() * 0.4
    const filtro = ctx.createBiquadFilter()
    filtro.type = tipo
    filtro.Q.value = q
    filtro.frequency.setValueAtTime(desde, t)
    filtro.frequency.exponentialRampToValueAtTime(hasta, t + duracion)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(volumen, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion)
    fuente.connect(filtro).connect(g).connect(salida)
    fuente.start(t)
    fuente.stop(t + duracion + 0.05)
  }

  /** Each effect gets its output node `s` (already placed) and an optional strength 0 … 1 */
  const EFECTOS = {
    explosion(s) {
      soplo(s, { duracion: 1.1, volumen: 0.9, desde: 3500, hasta: 60 })
      tono(s, 85, { tipo: 'sine', duracion: 0.7, volumen: 0.8, hasta: 28 })
      // Crackle of debris
      for (let i = 0; i < 9; i++) {
        soplo(s, { inicio: 0.08 + Math.random() * 0.7, duracion: 0.05, volumen: 0.25, desde: 4000, hasta: 1500, tipo: 'bandpass', q: 3 })
      }
    },
    /** I blew up: a sad descending trombone */
    eliminado(s) {
      ;[392, 370, 349, 330].forEach((f, i) =>
        tono(s, f, { tipo: 'triangle', inicio: 0.25 + i * 0.22, duracion: i === 3 ? 0.7 : 0.2, volumen: 0.16, hasta: i === 3 ? 250 : undefined }),
      )
    },
    choque(s, fuerza = 0.5) {
      tono(s, 140, { tipo: 'triangle', duracion: 0.22, volumen: 0.3 + fuerza * 0.3, hasta: 55 })
      soplo(s, { duracion: 0.18, volumen: 0.2 + fuerza * 0.3, desde: 2600, hasta: 700, tipo: 'bandpass', q: 2 })
      tono(s, 900 + Math.random() * 300, { tipo: 'square', duracion: 0.06, volumen: 0.04 }) // metal clank
    },
    coletazo(s) {
      EFECTOS.choque(s, 1)
      soplo(s, { inicio: 0.05, duracion: 0.7, volumen: 0.3, desde: 2600, hasta: 1100, tipo: 'bandpass', q: 6 })
    },
    muro(s, fuerza = 0.5) {
      tono(s, 70, { tipo: 'sine', duracion: 0.25, volumen: 0.3 + fuerza * 0.4, hasta: 35 })
      soplo(s, { duracion: 0.15, volumen: 0.15 + fuerza * 0.25, desde: 1200, hasta: 300 })
    },
    golpe(s) {
      tono(s, 160, { tipo: 'triangle', duracion: 0.25, volumen: 0.35, hasta: 60 })
      soplo(s, { duracion: 0.15, volumen: 0.25, desde: 1500, hasta: 300 })
    },
    salpicada(s) {
      soplo(s, { duracion: 0.5, volumen: 0.35, desde: 1800, hasta: 300, tipo: 'bandpass', q: 1.5 })
      for (let i = 0; i < 4; i++) tono(s, 500 + Math.random() * 500, { tipo: 'sine', inicio: i * 0.06, duracion: 0.08, volumen: 0.06, hasta: 1400 })
    },
    item(s) {
      ;[660, 880, 1320, 1760].forEach((f, i) => tono(s, f, { inicio: i * 0.05, duracion: 0.14, volumen: 0.07 }))
      soplo(s, { duracion: 0.35, volumen: 0.08, desde: 9000, hasta: 4000, tipo: 'highpass' })
    },
    usar(s) {
      soplo(s, { duracion: 0.3, volumen: 0.25, desde: 400, hasta: 3000, tipo: 'bandpass' })
    },
    /** Hee-haw: the Burro percherón announces itself */
    rebuzno(s) {
      for (let i = 0; i < 2; i++) {
        tono(s, 620, { tipo: 'sawtooth', inicio: i * 0.5, duracion: 0.22, volumen: 0.12, hasta: 820 })
        tono(s, 330, { tipo: 'sawtooth', inicio: i * 0.5 + 0.22, duracion: 0.26, volumen: 0.12, hasta: 260 })
      }
      for (let i = 0; i < 6; i++) tono(s, 180, { tipo: 'square', inicio: i * 0.09, duracion: 0.04, volumen: 0.05 }) // hooves
    },
    bache(s) {
      tono(s, 90, { tipo: 'sine', duracion: 0.3, volumen: 0.4, hasta: 40 })
      soplo(s, { duracion: 0.25, volumen: 0.25, desde: 900, hasta: 150 })
    },
    charco(s) {
      EFECTOS.salpicada(s)
    },
    /** 47 °C: a whoosh of hot air and a sizzle */
    calor(s) {
      soplo(s, { duracion: 0.6, volumen: 0.3, desde: 300, hasta: 2500, tipo: 'bandpass' })
      soplo(s, { inicio: 0.1, duracion: 1, volumen: 0.12, desde: 7000, hasta: 4000, tipo: 'highpass' })
    },
    /** Carne asada smoke: a long sizzle */
    humo(s) {
      soplo(s, { duracion: 1.4, volumen: 0.18, desde: 6000, hasta: 2500, tipo: 'highpass' })
      soplo(s, { duracion: 0.8, volumen: 0.15, desde: 900, hasta: 300 })
    },
    tope(s) {
      tono(s, 120, { tipo: 'square', duracion: 0.08, volumen: 0.15 })
      tono(s, 100, { tipo: 'square', inicio: 0.12, duracion: 0.1, volumen: 0.15 })
    },
    /** Coyotas: five quick "fwip"s */
    coyotas(s) {
      for (let i = 0; i < 5; i++) soplo(s, { inicio: i * 0.04, duracion: 0.12, volumen: 0.18, desde: 800, hasta: 3500, tipo: 'bandpass', q: 3 })
    },
    /** El camión urbano: its horn, twice, and the turbo */
    claxon(s) {
      for (const inicio of [0, 0.28]) {
        tono(s, 330, { tipo: 'square', inicio, duracion: 0.22, volumen: 0.1 })
        tono(s, 415, { tipo: 'square', inicio, duracion: 0.22, volumen: 0.1 })
      }
      soplo(s, { inicio: 0.1, duracion: 1.2, volumen: 0.2, desde: 300, hasta: 1800, tipo: 'bandpass' })
    },
    cambio(s) {
      soplo(s, { duracion: 0.06, volumen: 0.05, desde: 2000, hasta: 800, tipo: 'bandpass', q: 4 })
    },
    cuenta(s) {
      tono(s, 440, { tipo: 'sine', duracion: 0.2, volumen: 0.22 })
    },
    arranque(s) {
      tono(s, 880, { tipo: 'sine', duracion: 0.5, volumen: 0.28 })
    },
    punto(s) {
      ;[523, 659, 784, 1047].forEach((f, i) => tono(s, f, { tipo: 'triangle', inicio: i * 0.09, duracion: 0.25, volumen: 0.15 }))
    },
    victoria(s) {
      const notas = [523, 659, 784, 1047, 784, 1047, 1319]
      notas.forEach((f, i) => tono(s, f, { tipo: 'triangle', inicio: i * 0.12, duracion: i === notas.length - 1 ? 0.8 : 0.16, volumen: 0.16 }))
      notas.forEach((f, i) => tono(s, f / 2, { tipo: 'square', inicio: i * 0.12, duracion: 0.14, volumen: 0.05 }))
    },
    derrota(s) {
      ;[523, 494, 466].forEach((f, i) => tono(s, f, { tipo: 'triangle', inicio: i * 0.3, duracion: 0.35, volumen: 0.14 }))
    },
  }

  return {
    /** Call from a user gesture */
    activar() {
      iniciar()
      ctx?.resume()
    },

    /** Where things are heard from (the camera) */
    oyente(x, y, rumbo) {
      oyente.x = x
      oyente.y = y
      oyente.rumbo = rumbo
    },

    /**
     * Every frame, with the own car. velocidad 0 … 1 (forward, fraction of top speed),
     * acel 0 … 1, derrape 0 … 1, tierra (on dirt), activo (alive and driving).
     */
    motor({ velocidad = 0, acel = 0, derrape = 0, tierra = false, activo = true }) {
      if (!ctx || !propio) return
      if (!activo) {
        propio.apagar()
        for (const capa of Object.values(llantas)) capa.volumen.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
        return
      }
      const { rpm, marcha } = rpmDe(Math.abs(velocidad))
      // Wheelspin: throttle while sliding revs the engine up
      const giro = Math.min(1, rpm + (acel > 0 ? derrape * 0.2 : 0))
      propio.poner(giro, acel, 1)
      if (marcha > marchaAnterior && acel > 0) EFECTOS.cambio(destino(null, 'motor'))
      marchaAnterior = marcha

      const t = ctx.currentTime
      const chillido = !tierra ? Math.max(0, derrape - 0.3) * Math.min(1, Math.abs(velocidad) * 3) : 0
      llantas.chillido.volumen.gain.setTargetAtTime(chillido * 0.16, t, 0.04)
      llantas.chillidoAlto.volumen.gain.setTargetAtTime(chillido * 0.06, t, 0.04)
      llantas.chillido.filtro.frequency.setTargetAtTime(1200 + derrape * 500, t, 0.05)
      llantas.grava.volumen.gain.setTargetAtTime(tierra ? Math.min(1, Math.abs(velocidad) * 2) * 0.3 : 0, t, 0.06)
    },

    /** Every frame: the other cars [{ id, velocidad, x, y }] (velocidad as in motor()) */
    otrosMotores(lista) {
      if (!ctx) return
      const vistos = new Set()
      for (const c of lista) {
        vistos.add(c.id)
        let voz = voces.get(c.id)
        if (!voz) voces.set(c.id, (voz = crearMotor(false, buses.otros)))
        const { volumen, pan } = lugar(c)
        voz.poner(rpmDe(Math.abs(c.velocidad)).rpm, 0.6, volumen * 0.6, pan)
      }
      for (const [id, voz] of voces) {
        if (vistos.has(id)) continue
        voz.apagar()
        setTimeout(() => voz.destruir(), 500)
        voces.delete(id)
      }
    },

    /** A one-shot. `pos` = { x, y } where it happens (null: everywhere), `fuerza` 0 … 1 */
    efecto(nombre, pos = null, fuerza) {
      if (!ctx || !EFECTOS[nombre]) return
      EFECTOS[nombre](destino(pos, CANAL_DE[nombre]), fuerza)
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
      if (maestro) maestro.gain.setTargetAtTime(silencio ? 0 : ajustes.general, ctx.currentTime, 0.05)
      return silencio
    },

    /** Current settings (a copy) */
    get ajustes() {
      return { ...ajustes }
    },

    /** Changes one setting live and remembers it */
    ponerAjuste(clave, valor) {
      if (!(clave in AJUSTES_SONIDO)) return
      ajustes[clave] = Number(valor)
      try {
        localStorage.setItem(GUARDADO_AJUSTES, JSON.stringify(ajustes))
      } catch {
        // Private mode: it just won't be remembered
      }
      if (!ctx) return
      const t = ctx.currentTime
      if (clave === 'general' && !silencio) maestro.gain.setTargetAtTime(ajustes.general, t, 0.05)
      if (buses[clave]) buses[clave].gain.setTargetAtTime(ajustes[clave], t, 0.05)
      if (clave === 'grunido') propio.distorsion.curve = curvaDistorsion(ajustes.grunido)
    },

    restablecer() {
      for (const [clave, valor] of Object.entries(AJUSTES_SONIDO)) this.ponerAjuste(clave, valor)
    },

    /** Plays a sample of a channel, to hear a slider's change */
    probar(clave) {
      if (MUESTRA[clave]) this.efecto(MUESTRA[clave])
      else if (clave === 'general') this.efecto('item')
    },

    destruir() {
      for (const voz of voces.values()) voz.destruir()
      voces.clear()
      ctx?.close()
      ctx = null
    },
  }
}

/** Which effect each item makes when used (by item id); unknown items use the generic whoosh */
export const SONIDO_USAR = {
  burro: 'rebuzno',
  bache: 'bache',
  charco: 'charco',
  calor: 'calor',
  humo: 'humo',
  tope: 'tope',
  coyotas: 'coyotas',
  camion: 'claxon',
}
