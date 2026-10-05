const whatsapp = (import.meta.env.VITE_WHATSAPP || '').replace(/\D/g, '')

export const config = {
  nombre: 'Jorge García',
  serie: 'Haciendo proyectos hasta que una empresa me contacte',
  presentacion:
    'Ingeniero en Mecatrónica en Hermosillo. Construyo hardware y software que resuelve problemas reales, y lo explico claro.',
  cvUrl: import.meta.env.VITE_CV_URL || '',
  whatsappUrl: whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent('Hola Jorge, vi tu portafolio y me gustaría platicar.')}`
    : '',
  zonaHoraria: 'America/Hermosillo',
}
