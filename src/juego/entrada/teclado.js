/**
 * Keyboard controls. Every input source (keyboard now, touch later) exposes the same
 * `leer()` → { giro, acel, freno, mano, item }, and crearEntrada() merges them, so the game
 * never knows where the controls come from.
 *
 * Keys go by `code` (physical position), so WASD works the same on any keyboard layout.
 */
const TECLAS = {
  ArrowUp: 'acel',
  KeyW: 'acel',
  ArrowDown: 'freno',
  KeyS: 'freno',
  ArrowLeft: 'izquierda',
  KeyA: 'izquierda',
  ArrowRight: 'derecha',
  KeyD: 'derecha',
  ShiftLeft: 'item',
  ShiftRight: 'item',
  KeyE: 'item',
}

/** Listens on `elemento` (the focused game canvas) so the arrows don't scroll the page */
export function crearTeclado(elemento) {
  const activas = new Set()
  // The item key is a tap: remember it was pressed until the next read, or a tap shorter
  // than one tick (33 ms) would be lost between two reads
  let itemPendiente = false

  const abajo = (e) => {
    const accion = TECLAS[e.code]
    if (!accion) return
    e.preventDefault()
    activas.add(accion)
    if (accion === 'item' && !e.repeat) itemPendiente = true
  }
  const arriba = (e) => {
    const accion = TECLAS[e.code]
    if (accion) activas.delete(accion)
  }
  // Letting go of the window with a key down would leave it stuck
  const soltarTodo = () => activas.clear()

  elemento.addEventListener('keydown', abajo)
  elemento.addEventListener('keyup', arriba)
  elemento.addEventListener('blur', soltarTodo)

  return {
    leer() {
      const item = activas.has('item') || itemPendiente
      itemPendiente = false
      return {
        giro: (activas.has('derecha') ? 1 : 0) - (activas.has('izquierda') ? 1 : 0),
        acel: activas.has('acel') ? 1 : 0,
        freno: activas.has('freno') ? 1 : 0,
        // No handbrake key any more (it wasn't easy to use); the physics still has it for the bots
        mano: false,
        item,
      }
    },
    destruir() {
      elemento.removeEventListener('keydown', abajo)
      elemento.removeEventListener('keyup', arriba)
      elemento.removeEventListener('blur', soltarTodo)
    },
  }
}

/** Merges several input sources into one */
export function crearEntrada(fuentes) {
  return {
    leer() {
      const total = { giro: 0, acel: 0, freno: 0, mano: false, item: false }
      for (const f of fuentes) {
        const c = f.leer()
        total.giro += c.giro
        total.acel = Math.max(total.acel, c.acel)
        total.freno = Math.max(total.freno, c.freno)
        total.mano ||= c.mano
        total.item ||= c.item
      }
      total.giro = Math.max(-1, Math.min(1, total.giro))
      return total
    },
    destruir() {
      fuentes.forEach((f) => f.destruir())
    },
  }
}
