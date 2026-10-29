/** Blend between two physics states for drawing between ticks (the angle takes the short way) */
export function interpolarCarro(a, b, t) {
  let da = b.angulo - a.angulo
  if (da > Math.PI) da -= Math.PI * 2
  if (da < -Math.PI) da += Math.PI * 2
  return {
    ...b,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angulo: a.angulo + da * t,
    w: a.w + (b.w - a.w) * t,
    z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t,
  }
}
