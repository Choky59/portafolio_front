/**
 * Same rules as the backend (portafolio_back/src/constants/archivos.ts),
 * so the panel can warn before uploading. The backend and Storage enforce them anyway.
 */
const MB = 1024 * 1024

export const POR_EXTENSION = {
  mp4: { contentType: 'video/mp4', categoria: 'videos' },
  webm: { contentType: 'video/webm', categoria: 'videos' },
  mov: { contentType: 'video/quicktime', categoria: 'videos' },
  zip: { contentType: 'application/zip', categoria: 'descargas' },
  jpg: { contentType: 'image/jpeg', categoria: 'imagenes' },
  jpeg: { contentType: 'image/jpeg', categoria: 'imagenes' },
  png: { contentType: 'image/png', categoria: 'imagenes' },
  webp: { contentType: 'image/webp', categoria: 'imagenes' },
  glb: { contentType: 'model/gltf-binary', categoria: 'modelos' },
}

export const ACCEPT = Object.keys(POR_EXTENSION).map((e) => `.${e}`).join(',')

export const CATEGORIAS = {
  videos: {
    titulo: 'Videos',
    maximo: 1024 * MB,
    ayuda: 'Elige en "Usar en" qué parte del proyecto reproduce cada video. El cambio se ve en la página al instante, sin desplegar nada.',
  },
  descargas: {
    titulo: 'Descargas (.zip)',
    maximo: 200 * MB,
    ayuda: '"Copiar para JSON" da el fragmento para pegarlo en "descargas" del JSON del proyecto.',
  },
  imagenes: {
    titulo: 'Imágenes',
    maximo: 20 * MB,
    ayuda: '"Copiar para JSON" da el fragmento para usarla como "poster" de un video o escena.',
  },
  modelos: {
    titulo: 'Modelos 3D',
    maximo: 100 * MB,
    ayuda: '"Copiar para JSON" da el fragmento para pegarlo como "modelo3d" del JSON del proyecto.',
  },
}

/** { contentType, categoria } or an error message for files we can't upload */
export function clasificar(file) {
  const extension = (file.name.split('.').pop() || '').toLowerCase()
  const tipo = POR_EXTENSION[extension]
  if (!tipo) return { error: 'Tipo no permitido. Usa mp4, webm, mov, zip, jpg, png, webp o glb.' }

  const { maximo } = CATEGORIAS[tipo.categoria]
  if (file.size > maximo) return { error: `Pesa ${formatearTamano(file.size)}; el máximo para ${CATEGORIAS[tipo.categoria].titulo.toLowerCase()} es ${formatearTamano(maximo)}.` }

  return tipo
}

export function formatearTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`
  return `${(bytes / 1024 / MB).toFixed(2)} GB`
}

const sinExtension = (nombre) => nombre.replace(/\.[^.]+$/, '')

/** Snippet ready to paste in content/proyectos/<slug>.json */
export function fragmentoJson(archivo) {
  const titulo = sinExtension(archivo.nombre)
  switch (archivo.categoria) {
    case 'videos':
      return `"src": ${JSON.stringify(archivo.url)}`
    case 'descargas':
      return JSON.stringify({ titulo, url: archivo.url, tipo: 'zip' }, null, 2)
    case 'imagenes':
      return `"poster": ${JSON.stringify(archivo.url)}`
    case 'modelos':
      return `"modelo3d": ${JSON.stringify({ src: archivo.url }, null, 2)}`
    default:
      return JSON.stringify(archivo.url)
  }
}
