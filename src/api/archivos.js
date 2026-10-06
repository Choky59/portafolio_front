import { ApiError, api } from './client'

/** [{ path, nombre, slug, categoria, contentType, tamano, subidoEn, url }] */
export async function listarArchivos(slug, signal) {
  const res = await api(`/archivos?slug=${encodeURIComponent(slug)}`, { auth: true, signal })
  return res.archivos
}

/** { path, uploadUrl, headers, expiresAt } */
export function pedirSubida({ slug, nombre, contentType, tamano }) {
  return api('/archivos/subidas', { method: 'POST', auth: true, body: { slug, nombre, contentType, tamano } })
}

export async function confirmarSubida(path, nombre) {
  const res = await api('/archivos/confirmar', { method: 'POST', auth: true, body: { path, nombre } })
  return res.archivo
}

export function borrarArchivo(path) {
  return api(`/archivos?path=${encodeURIComponent(path)}`, { method: 'DELETE', auth: true })
}

/**
 * PUT straight to Firebase Storage with the signed URL.
 * XHR instead of fetch because fetch can't report upload progress.
 * Returns { promesa, cancelar }.
 */
export function subirArchivo(uploadUrl, file, headers, onProgreso) {
  const xhr = new XMLHttpRequest()

  const promesa = new Promise((resolve, reject) => {
    xhr.open('PUT', uploadUrl)
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgreso?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new ApiError(xhr.status, { message: `Storage respondió ${xhr.status}` }))
    }
    // The browser hides the reason: it's either the network or the bucket CORS (npm run storage:cors)
    xhr.onerror = () => reject(new ApiError(0, { error: { key: 'SUBIDA_BLOQUEADA' } }))
    xhr.onabort = () => reject(Object.assign(new Error('Subida cancelada'), { name: 'AbortError' }))

    xhr.send(file)
  })

  return { promesa, cancelar: () => xhr.abort() }
}
