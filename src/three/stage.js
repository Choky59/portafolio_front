import * as THREE from 'three'
import { leerPaleta } from './paleta.js'

/**
 * Plain JS (no Vue) wrapper around a Three.js renderer for one canvas.
 *
 * `crearEscena()` returns a scene object with this contract:
 *   setup(ctx)                 build meshes, lights and camera; ctx = { THREE, scene, camera,
 *                              renderer, canvas, paleta, params, reducedMotion, requestRender }
 *   update(dt, t, input)       per frame; input = { x, y } pointer in [-1, 1], { scroll } in [0, 1]
 *   setParams?(params)         new data from Vue (e.g. temperature)
 *   resize?(width, height)
 *   dispose?()                 anything not attached to the scene (controls, loaders)
 *   tiempoEstatico?: number    `t` used to draw the finished frame with reduced motion
 *
 * The stage handles canvas size, devicePixelRatio, the animation loop and cleanup.
 */
export function createStage(canvas, crearEscena, { params = {}, reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200)
  const input = { x: 0, y: 0, scroll: 0 }

  let raf = 0
  let running = false
  let disposed = false
  let elapsed = 0
  let last = 0

  const escena = crearEscena()
  const ctx = {
    THREE,
    scene,
    camera,
    renderer,
    canvas,
    paleta: leerPaleta(),
    params,
    reducedMotion,
    requestRender,
  }
  escena.setup(ctx)

  function render() {
    renderer.render(scene, camera)
  }

  /** For scenes that change outside the loop (e.g. a model finished loading) */
  function requestRender() {
    if (!running && !disposed) {
      escena.update?.(0, escena.tiempoEstatico ?? elapsed, input)
      render()
    }
  }

  function frame(now) {
    if (!running) return
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    elapsed += dt
    escena.update?.(dt, elapsed, input)
    render()
    raf = requestAnimationFrame(frame)
  }

  function resize() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    escena.resize?.(width, height)
    if (!running) requestRender()
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  resize()

  return {
    start() {
      if (running || disposed) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    },

    stop() {
      running = false
      cancelAnimationFrame(raf)
    },

    /** Draws the finished frame once (reduced motion) */
    renderOnce() {
      if (disposed) return
      escena.update?.(0, escena.tiempoEstatico ?? elapsed, input)
      render()
    },

    setInput(next) {
      Object.assign(input, next)
    },

    setParams(next) {
      ctx.params = next
      escena.setParams?.(next)
      requestRender()
    },

    dispose() {
      if (disposed) return
      disposed = true
      running = false
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      escena.dispose?.()

      scene.traverse((obj) => {
        obj.geometry?.dispose()
        const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
        for (const material of materials) {
          for (const value of Object.values(material)) {
            if (value?.isTexture) value.dispose()
          }
          material.dispose()
        }
      })

      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
