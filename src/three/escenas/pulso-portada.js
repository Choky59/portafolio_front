import { crearSimulacion } from '../pulso/simulacion.js'
import { crearMultitud } from '../pulso/multitud.js'
import { crearNoticias } from '../pulso/noticias.js'
import { texturaPapel } from '../pulso/lapiz.js'
import { acercar } from '../piezas.js'

/**
 * Cover for Proyecto #2 (card and header): small groups split between a happy
 * news item and an annoying one and take the color of what each one makes them
 * feel; short stays, so they keep switching sides (and colors). Light: ~24 people,
 * no HTML layer and no controls.
 */
const NOTICIAS = [
  {
    id: 'portada-buena',
    titulo: 'Buena noticia',
    fuente: { tipo: 'radio' },
    relevancia: 0.25,
    sentimiento: { emociones: { alegria: 0.7, sorpresa: 0.2 } },
  },
  {
    id: 'portada-mala',
    titulo: 'Mala noticia',
    fuente: { tipo: 'tv' },
    relevancia: 0.2,
    sentimiento: { emociones: { enojo: 0.6, tristeza: 0.2, miedo: 0.1 } },
  },
]

export default function crearPortadaPulso() {
  let sim, multitud, noticias, grupo
  let inclinacion = 0
  let reducido = false

  return {
    tiempoEstatico: 1,

    setup(ctx) {
      const { THREE, scene, camera, paleta } = ctx

      scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 1.6))
      const sol = new THREE.DirectionalLight(0xffffff, 1.6)
      sol.position.set(-6, 12, -4)
      scene.add(sol)

      // grupo turns toward the pointer; contenido is shifted so the pair of news is centered
      grupo = new THREE.Group()
      const contenido = new THREE.Group()
      grupo.add(contenido)
      scene.add(grupo)

      const papel = texturaPapel(THREE)
      papel.repeat.set(4, 4)
      const piso = new THREE.Mesh(
        new THREE.CircleGeometry(14, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: papel })
      )
      scene.add(piso)

      noticias = crearNoticias(THREE, NOTICIAS.length, {
        separacion: 5.5,
        margen: 1.5,
        // Small circles: few people and three news close together
        radio: (n) => 1.6 + (n.relevancia ?? 0.5) * 1.6,
      })
      NOTICIAS.forEach((noticia, k) => noticias.poner(k, noticia))
      noticias.update(0, 1) // shown right away, without the pop-in
      contenido.add(noticias.grupo)

      sim = crearSimulacion(24, { seed: 3, limite: noticias.limite, estancia: [6, 12], cambiar: 0.5 })
      multitud = crearMultitud(THREE, sim, paleta)
      contenido.add(multitud.grupo)
      sim.setPuntos(noticias.puntos, { limite: noticias.limite, todos: true })

      const [a, b] = noticias.puntos
      contenido.position.set(-(a.x + b.x) / 2, 0, -(a.z + b.z) / 2)

      camera.position.set(0, 8.5, 8)
      camera.lookAt(0, 0, 0.4)

      reducido = ctx.reducedMotion
      if (reducido) sim.asentar()
      multitud.actualizar(0, reducido)
    },

    update(dt, t, input) {
      inclinacion = acercar(inclinacion, input.x * 0.25, dt || 1, 3)
      grupo.rotation.y = inclinacion

      if (dt > 0) sim.paso(dt)
      noticias.update(t, dt || 1)
      multitud.actualizar(t, reducido)
    },
  }
}
