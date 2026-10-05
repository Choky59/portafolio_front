import { acercar, luces, material, rng } from '../piezas.js'

/**
 * Default cover for projects without their own scene:
 * a faceted gem in the accent color with small shards orbiting it.
 * params.numero changes the arrangement so each project looks a bit different.
 */
export default function crearPortadaGenerica() {
  let gema, orbita
  let inclinacion = 0

  return {
    tiempoEstatico: 1,

    setup(ctx) {
      const { THREE, scene, camera, paleta, params } = ctx
      const random = rng(params?.numero ?? 1)
      luces(THREE, scene, paleta)

      gema = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 0), material(THREE, paleta.accent))
      scene.add(gema)

      orbita = new THREE.Group()
      const colores = [paleta.frio, paleta.ideal, paleta.calor, paleta.extremo]
      for (let i = 0; i < 9; i++) {
        const shard = new THREE.Mesh(
          new THREE.TetrahedronGeometry(0.18 + random() * 0.15),
          material(THREE, colores[i % colores.length])
        )
        const angulo = (i / 9) * Math.PI * 2
        const radio = 2.2 + random() * 0.6
        shard.position.set(Math.cos(angulo) * radio, (random() - 0.5) * 1.6, Math.sin(angulo) * radio)
        orbita.add(shard)
      }
      scene.add(orbita)

      camera.position.set(0, 1.2, 7)
      camera.lookAt(0, 0, 0)
    },

    update(dt, t, input) {
      inclinacion = acercar(inclinacion, input.x * 0.5, dt || 1, 3)
      gema.rotation.y = t * 0.4 + inclinacion
      gema.rotation.x = Math.sin(t * 0.5) * 0.2
      orbita.rotation.y = -t * 0.25
    },
  }
}
