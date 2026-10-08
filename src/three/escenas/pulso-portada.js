import { crearSimulacion } from '../pulso/simulacion.js'
import { crearMultitud } from '../pulso/multitud.js'
import { crearNoticias } from '../pulso/noticias.js'
import { texturaPapel } from '../pulso/lapiz.js'
import { acercar } from '../piezas.js'

/**
 * Cover for Proyecto #2 (card and header): small groups stroll between a happy
 * news item and an annoying one, and every few seconds there's a shout at one of
 * them: the ones who hear it rush there and take its emotion's color. Light:
 * ~24 people, no HTML layer and no controls.
 */
const NOTICIAS = [
  {
    id: 'portada-buena',
    titulo: 'Buena noticia',
    fuente: { tipo: 'radio' },
    relevancia: 0.25,
    sentimiento: { emociones: { alegria: 0.7, sorpresa: 0.2, neutral: 0.1 } },
  },
  {
    id: 'portada-mala',
    titulo: 'Mala noticia',
    fuente: { tipo: 'tv' },
    relevancia: 0.2,
    sentimiento: { emociones: { enojo: 0.6, tristeza: 0.2, miedo: 0.1, neutral: 0.1 } },
  },
]
const CAMBIO_CADA = 7
const OYENTES = 10

export default function crearPortadaPulso() {
  let sim, multitud, noticias, grupo
  let inclinacion = 0
  let turno = -1

  /** Shout at news k, a bit in front of its pedestal */
  function gritarEn(k) {
    const p = noticias.puntos[k]
    sim.gritar(p.x, p.z + 0.8, OYENTES)
  }

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

      noticias = crearNoticias(THREE, NOTICIAS.length, { separacion: 5.5, margen: 1.5 })
      NOTICIAS.forEach((noticia, k) => noticias.poner(k, noticia))
      noticias.update(0, 1) // shown right away, without the pop-in
      contenido.add(noticias.grupo)

      sim = crearSimulacion(24, { seed: 3, limite: noticias.limite })
      multitud = crearMultitud(THREE, sim, paleta)
      contenido.add(multitud.grupo)
      sim.setPuntos(noticias.puntos, { limite: noticias.limite, todos: true })
      gritarEn(0)
      turno = 0

      const [a, b] = noticias.puntos
      contenido.position.set(-(a.x + b.x) / 2, 0, -(a.z + b.z) / 2)

      camera.position.set(0, 8.5, 8)
      camera.lookAt(0, 0, 0.4)

      if (ctx.reducedMotion) sim.asentar()
      multitud.actualizar()
    },

    update(dt, t, input) {
      // Alternate which news gets the shout
      const nuevoTurno = Math.floor(t / CAMBIO_CADA) % 2
      if (dt > 0 && nuevoTurno !== turno) {
        turno = nuevoTurno
        gritarEn(turno)
      }

      inclinacion = acercar(inclinacion, input.x * 0.25, dt || 1, 3)
      grupo.rotation.y = inclinacion

      if (dt > 0) sim.paso(dt)
      noticias.update(t, dt || 1)
      multitud.actualizar()
    },
  }
}
