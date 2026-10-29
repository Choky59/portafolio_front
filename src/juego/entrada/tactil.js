/**
 * Touch controls (the phone): an input source like the keyboard (`leer()` → { giro, acel, freno,
 * mano, item }), filled in by the on-screen controller (MandoTactil.vue). It serves the phone used
 * as a remote (modo local) and the game played on the phone.
 *
 * The car goes on its own: always on the gas, except while braking (and braking when stopped
 * backs up). With one thumb on the wheel, there's only one button left to think about.
 */
export function crearMando() {
  const estado = { giro: 0, freno: false, itemApretado: false, itemPendiente: false }

  return {
    estado,
    leer() {
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
