import * as THREE from 'three'
import { COLORES } from '../render/colores.js'

/**
 * The brand look in 3D: flat toon shading in a few light bands and an ink outline around
 * every object ("inverted hull": the same geometry a bit bigger, back faces only, in ink),
 * the same technique as the crowd of Proyecto #2.
 */

let gradiente = null

/** 3-step gradient for MeshToonMaterial: flat bands, like shading with a marker */
function gradienteToon() {
  if (gradiente) return gradiente
  const datos = new Uint8Array([150, 215, 255])
  gradiente = new THREE.DataTexture(datos, datos.length, 1, THREE.RedFormat)
  gradiente.minFilter = THREE.NearestFilter
  gradiente.magFilter = THREE.NearestFilter
  gradiente.generateMipmaps = false
  gradiente.needsUpdate = true
  return gradiente
}

const cache = new Map()

/** Shared toon material per color */
export function toon(color) {
  if (!cache.has(color)) cache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: gradienteToon() }))
  return cache.get(color)
}

const tinta = new THREE.MeshBasicMaterial({ color: COLORES.tinta, side: THREE.BackSide })

/**
 * Adds the ink outline to a mesh as a child, `grosor` meters thick on every side.
 * The copy is scaled per axis around the geometry's center, so boxes get an even line.
 */
export function conContorno(malla, grosor = 0.07) {
  const geo = malla.geometry
  geo.computeBoundingBox()
  const caja = geo.boundingBox
  const tam = caja.getSize(new THREE.Vector3())
  const centro = caja.getCenter(new THREE.Vector3())
  const escala = new THREE.Vector3(
    tam.x ? (tam.x + grosor * 2) / tam.x : 1,
    tam.y ? (tam.y + grosor * 2) / tam.y : 1,
    tam.z ? (tam.z + grosor * 2) / tam.z : 1,
  )
  if (malla.isInstancedMesh) {
    // A transform on the outline would also scale the instances' positions: bake the
    // scale into its own geometry and share the instance matrices instead
    const geoContorno = geo.clone().translate(-centro.x, -centro.y, -centro.z).scale(escala.x, escala.y, escala.z)
    geoContorno.translate(centro.x, centro.y, centro.z)
    const contorno = new THREE.InstancedMesh(geoContorno, tinta, malla.count)
    contorno.instanceMatrix = malla.instanceMatrix
    malla.add(contorno)
    return malla
  }
  const contorno = new THREE.Mesh(geo, tinta)
  contorno.scale.copy(escala)
  contorno.position.copy(centro).multiply(new THREE.Vector3(1 - escala.x, 1 - escala.y, 1 - escala.z))
  malla.add(contorno)
  return malla
}

/** A toon mesh with outline that casts and receives shadows */
export function pieza(geo, color, { grosor = 0.07, sombra = true } = {}) {
  const malla = new THREE.Mesh(geo, toon(color))
  malla.castShadow = sombra
  malla.receiveShadow = true
  return conContorno(malla, grosor)
}
