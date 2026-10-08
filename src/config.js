// +52 662 156 0190, written as wa.me expects it: country code + number, digits only
const whatsapp = '526621560190'

/** wa.me link with a prefilled message */
function whatsappLink(texto) {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}`
}

export const config = {
  nombre: 'Jorge García',
  serie: 'Construyendo proyectos y abierto a nuevas oportunidades',
  presentacion:
    'Ingeniero en Mecatrónica en Hermosillo. Construyo hardware y software que resuelve problemas reales, y lo explico claro.',
  cvUrl: import.meta.env.VITE_CV_URL || '',
  whatsappUrl: whatsappLink('Hola Jorge, vi tu portafolio y me gustaría platicar.'),
  // Recruiter-oriented message: "available" banner and the 2-minute dialog
  whatsappPropuestaUrl: whatsappLink('Hola Jorge, me ha gustado tu página y tengo una propuesta para ti.'),
  zonaHoraria: 'America/Hermosillo',
}
