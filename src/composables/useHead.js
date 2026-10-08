const DEFAULT_TITLE = 'Jorge García · Proyectos de hardware y software'
const DEFAULT_DESCRIPTION =
  'Ingeniero en Mecatrónica en Hermosillo. Construyendo proyectos de hardware y software y abierto a nuevas oportunidades.'

function metaTag(name) {
  let el = document.head.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  return el
}

/** Updates <title>, meta description and robots (noindex for admin / 404) */
export function setHead({ title, description, noindex = false } = {}) {
  document.title = title || DEFAULT_TITLE
  metaTag('description').setAttribute('content', description || DEFAULT_DESCRIPTION)

  if (noindex) {
    metaTag('robots').setAttribute('content', 'noindex, nofollow')
  } else {
    document.head.querySelector('meta[name="robots"]')?.remove()
  }
}
