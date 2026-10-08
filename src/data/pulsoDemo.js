/**
 * FICTIONAL sample news for "El pulso de Hermosillo" while the real pipeline
 * (recording → speech-to-text → categorization) doesn't exist yet.
 * Media and people are invented; the page labels them as examples.
 *
 * Same shape the news API will return:
 *   fuente.tipo: radio | tv | periodico | web
 *   entidades[].tipo: persona | organizacion | lugar
 *   sentimiento.emociones: shares that add up to 1
 *   sentimiento.polaridad: -1 (negative) … 1 (positive); intensidad: 0 … 1
 *   relevancia: 0 … 1, how many people it draws
 */
export const noticiasDemo = [
  {
    id: 'demo-parque',
    titulo: 'Abren un parque nuevo en el norte de la ciudad',
    resumen:
      'El nuevo parque tiene canchas, juegos infantiles con sombra y una pista para correr. Vecinos celebran que por fin haya un espacio verde cerca.',
    fuente: { tipo: 'radio', nombre: 'Radio Desierto 99.1', programa: 'Buenos días, Hermosillo' },
    fecha: '2026-10-06T08:15:00-07:00',
    categoria: 'Obras públicas',
    tags: ['parques', 'espacios públicos', 'deporte'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Ayuntamiento de Hermosillo', rol: 'responsable' },
      { tipo: 'persona', nombre: 'Laura Méndez (vecina)', rol: 'entrevistada' },
      { tipo: 'lugar', nombre: 'Colonia Pitic', rol: 'ubicación' },
    ],
    ubicacion: { colonia: 'Pitic' },
    sentimiento: {
      emociones: { alegria: 0.62, enojo: 0.05, tristeza: 0, miedo: 0, sorpresa: 0.13, neutral: 0.2 },
      polaridad: 0.7,
      intensidad: 0.6,
    },
    relevancia: 0.8,
  },
  {
    id: 'demo-calor',
    titulo: 'Se esperan 46 °C este fin de semana',
    resumen:
      'Protección Civil pide evitar salir entre las 11 y las 17 horas, hidratarse y no dejar mascotas en el patio. Habrá centros de hidratación abiertos.',
    fuente: { tipo: 'tv', nombre: 'Canal Saguaro', programa: 'Noticiero estelar' },
    fecha: '2026-10-06T21:00:00-07:00',
    categoria: 'Clima',
    tags: ['calor', 'protección civil', 'salud'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Protección Civil Sonora', rol: 'fuente' },
      { tipo: 'lugar', nombre: 'Hermosillo', rol: 'ubicación' },
    ],
    ubicacion: { colonia: 'Toda la ciudad' },
    sentimiento: {
      emociones: { alegria: 0, enojo: 0.15, tristeza: 0.1, miedo: 0.45, sorpresa: 0.05, neutral: 0.25 },
      polaridad: -0.5,
      intensidad: 0.7,
    },
    relevancia: 1,
  },
  {
    id: 'demo-trafico',
    titulo: 'Cierran carriles del bulevar Kino por obra de drenaje',
    resumen:
      'Durante tres semanas habrá un solo carril por sentido entre dos cruceros. Automovilistas se quejan de filas de hasta 20 minutos en hora pico.',
    fuente: { tipo: 'radio', nombre: 'Radio Desierto 99.1', programa: 'La hora del tráfico' },
    fecha: '2026-10-07T07:40:00-07:00',
    categoria: 'Movilidad',
    tags: ['tráfico', 'obras', 'drenaje'],
    entidades: [
      { tipo: 'lugar', nombre: 'Bulevar Kino', rol: 'ubicación' },
      { tipo: 'organizacion', nombre: 'Agua de Hermosillo', rol: 'responsable' },
      { tipo: 'persona', nombre: 'Carlos Ruiz (taxista)', rol: 'entrevistado' },
    ],
    ubicacion: { colonia: 'Country Club' },
    sentimiento: {
      emociones: { alegria: 0, enojo: 0.6, tristeza: 0.05, miedo: 0, sorpresa: 0.1, neutral: 0.25 },
      polaridad: -0.6,
      intensidad: 0.65,
    },
    relevancia: 0.7,
  },
  {
    id: 'demo-beisbol',
    titulo: 'El equipo local gana el primer juego de la temporada',
    resumen:
      'Estadio lleno y un jonrón en la novena entrada. La afición ya habla de campeonato desde el primer partido.',
    fuente: { tipo: 'periodico', nombre: 'El Diario del Sol', programa: 'Deportes' },
    fecha: '2026-10-05T23:30:00-07:00',
    categoria: 'Deportes',
    tags: ['béisbol', 'afición', 'temporada'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Club de béisbol local', rol: 'protagonista' },
      { tipo: 'lugar', nombre: 'Estadio de la ciudad', rol: 'ubicación' },
    ],
    ubicacion: { colonia: 'Villa de Seris' },
    sentimiento: {
      emociones: { alegria: 0.7, enojo: 0, tristeza: 0, miedo: 0, sorpresa: 0.2, neutral: 0.1 },
      polaridad: 0.85,
      intensidad: 0.8,
    },
    relevancia: 0.75,
  },
  {
    id: 'demo-apagon',
    titulo: 'Apagón de cuatro horas en varias colonias del poniente',
    resumen:
      'Una falla en un transformador dejó sin luz a miles de casas en plena tarde. Vecinos reportan que se descompuso comida y que no había a quién llamar.',
    fuente: { tipo: 'web', nombre: 'Hermosillo al Día', programa: 'Ciudad' },
    fecha: '2026-10-06T17:05:00-07:00',
    categoria: 'Servicios',
    tags: ['luz', 'apagón', 'servicios públicos'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Compañía de luz', rol: 'responsable' },
      { tipo: 'lugar', nombre: 'Colonia San Benito', rol: 'ubicación' },
    ],
    ubicacion: { colonia: 'San Benito' },
    sentimiento: {
      emociones: { alegria: 0, enojo: 0.55, tristeza: 0.2, miedo: 0.1, sorpresa: 0.05, neutral: 0.1 },
      polaridad: -0.75,
      intensidad: 0.75,
    },
    relevancia: 0.65,
  },
  {
    id: 'demo-festival',
    titulo: 'Anuncian festival de música y comida en la plaza principal',
    resumen:
      'Tres días de conciertos gratuitos, carne asada y coyotas. La sorpresa: el cartel incluye una banda que no venía a la ciudad desde hace 15 años.',
    fuente: { tipo: 'tv', nombre: 'Canal Saguaro', programa: 'Matutino' },
    fecha: '2026-10-07T09:00:00-07:00',
    categoria: 'Cultura',
    tags: ['música', 'festival', 'gastronomía'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Instituto de Cultura', rol: 'organizador' },
      { tipo: 'lugar', nombre: 'Plaza Zaragoza', rol: 'ubicación' },
    ],
    ubicacion: { colonia: 'Centro' },
    sentimiento: {
      emociones: { alegria: 0.5, enojo: 0, tristeza: 0, miedo: 0, sorpresa: 0.35, neutral: 0.15 },
      polaridad: 0.8,
      intensidad: 0.7,
    },
    relevancia: 0.6,
  },
  {
    id: 'demo-escuela',
    titulo: 'Cierran una primaria por daños en el techo',
    resumen:
      'Después de la lluvia del fin de semana se cayó parte del plafón de dos salones. Los alumnos tomarán clases en otra escuela mientras reparan.',
    fuente: { tipo: 'periodico', nombre: 'El Diario del Sol', programa: 'Local' },
    fecha: '2026-10-06T10:20:00-07:00',
    categoria: 'Educación',
    tags: ['escuelas', 'lluvia', 'infraestructura'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Secretaría de Educación', rol: 'responsable' },
      { tipo: 'persona', nombre: 'Ana Torres (madre de familia)', rol: 'entrevistada' },
      { tipo: 'lugar', nombre: 'Colonia Olivares', rol: 'ubicación' },
    ],
    ubicacion: { colonia: 'Olivares' },
    sentimiento: {
      emociones: { alegria: 0, enojo: 0.25, tristeza: 0.3, miedo: 0.25, sorpresa: 0.05, neutral: 0.15 },
      polaridad: -0.55,
      intensidad: 0.6,
    },
    relevancia: 0.5,
  },
  {
    id: 'demo-camiones',
    titulo: 'Llegan camiones urbanos con aire acondicionado',
    resumen:
      'Las nuevas unidades empiezan a circular en tres rutas. Usuarios dicen que es un cambio enorme con el calor, aunque piden más frecuencia.',
    fuente: { tipo: 'radio', nombre: 'Frecuencia Norte 88.3', programa: 'Noticias al mediodía' },
    fecha: '2026-10-07T12:10:00-07:00',
    categoria: 'Movilidad',
    tags: ['transporte público', 'camiones', 'calor'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Dirección de Transporte', rol: 'responsable' },
      { tipo: 'persona', nombre: 'Jesús Valenzuela (usuario)', rol: 'entrevistado' },
    ],
    ubicacion: { colonia: 'Toda la ciudad' },
    sentimiento: {
      emociones: { alegria: 0.45, enojo: 0.1, tristeza: 0, miedo: 0, sorpresa: 0.2, neutral: 0.25 },
      polaridad: 0.5,
      intensidad: 0.5,
    },
    relevancia: 0.55,
  },
  {
    id: 'demo-presupuesto',
    titulo: 'Presentan el presupuesto municipal del próximo año',
    resumen:
      'El documento propone más dinero para pavimentación y alumbrado. Se discutirá en cabildo la próxima semana.',
    fuente: { tipo: 'web', nombre: 'Hermosillo al Día', programa: 'Política' },
    fecha: '2026-10-07T14:30:00-07:00',
    categoria: 'Gobierno',
    tags: ['presupuesto', 'cabildo', 'pavimentación'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Cabildo de Hermosillo', rol: 'responsable' },
      { tipo: 'lugar', nombre: 'Palacio Municipal', rol: 'ubicación' },
    ],
    ubicacion: { colonia: 'Centro' },
    sentimiento: {
      emociones: { alegria: 0.1, enojo: 0.1, tristeza: 0, miedo: 0.05, sorpresa: 0.05, neutral: 0.7 },
      polaridad: 0.05,
      intensidad: 0.3,
    },
    relevancia: 0.35,
  },
  {
    id: 'demo-cerro',
    titulo: 'Inauguran nueva iluminación en el Cerro de la Campana',
    resumen:
      'El cerro ahora se ilumina de noche con luces LED que cambian de color en fechas especiales. Familias subieron a tomarse fotos desde el primer día.',
    fuente: { tipo: 'tv', nombre: 'Canal Saguaro', programa: 'Noticiero estelar' },
    fecha: '2026-10-07T20:15:00-07:00',
    categoria: 'Obras públicas',
    tags: ['iluminación', 'turismo', 'espacios públicos'],
    entidades: [
      { tipo: 'lugar', nombre: 'Cerro de la Campana', rol: 'ubicación' },
      { tipo: 'organizacion', nombre: 'Ayuntamiento de Hermosillo', rol: 'responsable' },
    ],
    ubicacion: { colonia: 'Centro' },
    sentimiento: {
      emociones: { alegria: 0.5, enojo: 0.05, tristeza: 0, miedo: 0, sorpresa: 0.3, neutral: 0.15 },
      polaridad: 0.7,
      intensidad: 0.55,
    },
    relevancia: 0.5,
  },
  {
    id: 'demo-agua',
    titulo: 'Anuncian tandeo de agua en colonias del sur',
    resumen:
      'Por trabajos en un acueducto, varias colonias tendrán agua solo por las mañanas durante dos semanas. Vecinos piden pipas y más aviso.',
    fuente: { tipo: 'radio', nombre: 'Frecuencia Norte 88.3', programa: 'Noticias al mediodía' },
    fecha: '2026-10-07T13:05:00-07:00',
    categoria: 'Servicios',
    tags: ['agua', 'tandeo', 'servicios públicos'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Agua de Hermosillo', rol: 'responsable' },
      { tipo: 'persona', nombre: 'Rosa Félix (vecina)', rol: 'entrevistada' },
    ],
    ubicacion: { colonia: 'Solidaridad' },
    sentimiento: {
      emociones: { alegria: 0, enojo: 0.5, tristeza: 0.2, miedo: 0.15, sorpresa: 0.05, neutral: 0.1 },
      polaridad: -0.65,
      intensidad: 0.7,
    },
    relevancia: 0.6,
  },
  {
    id: 'demo-feria',
    titulo: 'Feria del libro trae a autores de todo el país',
    resumen:
      'Una semana de presentaciones, talleres para niños y descuentos en la explanada de la universidad. La entrada es gratuita.',
    fuente: { tipo: 'periodico', nombre: 'El Diario del Sol', programa: 'Cultura' },
    fecha: '2026-10-06T09:40:00-07:00',
    categoria: 'Cultura',
    tags: ['libros', 'feria', 'educación'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Universidad local', rol: 'organizador' },
      { tipo: 'lugar', nombre: 'Explanada universitaria', rol: 'ubicación' },
    ],
    ubicacion: { colonia: 'Centro Norte' },
    sentimiento: {
      emociones: { alegria: 0.45, enojo: 0, tristeza: 0, miedo: 0, sorpresa: 0.15, neutral: 0.4 },
      polaridad: 0.6,
      intensidad: 0.4,
    },
    relevancia: 0.4,
  },
  {
    id: 'demo-choque',
    titulo: 'Choque múltiple en el periférico deja tres heridos',
    resumen:
      'Cuatro autos se impactaron en la mañana por el exceso de velocidad. Los heridos están estables y el tráfico se normalizó al mediodía.',
    fuente: { tipo: 'web', nombre: 'Hermosillo al Día', programa: 'Seguridad' },
    fecha: '2026-10-07T08:20:00-07:00',
    categoria: 'Seguridad',
    tags: ['accidente', 'tráfico', 'periférico'],
    entidades: [
      { tipo: 'organizacion', nombre: 'Cruz Roja', rol: 'atención' },
      { tipo: 'lugar', nombre: 'Periférico Norte', rol: 'ubicación' },
    ],
    ubicacion: { colonia: 'Norte' },
    sentimiento: {
      emociones: { alegria: 0, enojo: 0.15, tristeza: 0.3, miedo: 0.4, sorpresa: 0.1, neutral: 0.05 },
      polaridad: -0.7,
      intensidad: 0.75,
    },
    relevancia: 0.65,
  },
  {
    id: 'demo-lluvia',
    titulo: 'Llega la primera lluvia del otoño',
    resumen:
      'Después de meses de calor, una tormenta bajó la temperatura a 26 °C. Hubo encharcamientos en algunos bulevares, pero la gente salió a disfrutar el fresco.',
    fuente: { tipo: 'radio', nombre: 'Radio Desierto 99.1', programa: 'Buenas tardes' },
    fecha: '2026-10-05T18:30:00-07:00',
    categoria: 'Clima',
    tags: ['lluvia', 'clima', 'encharcamientos'],
    entidades: [{ tipo: 'lugar', nombre: 'Hermosillo', rol: 'ubicación' }],
    ubicacion: { colonia: 'Toda la ciudad' },
    sentimiento: {
      emociones: { alegria: 0.55, enojo: 0.1, tristeza: 0, miedo: 0.05, sorpresa: 0.2, neutral: 0.1 },
      polaridad: 0.6,
      intensidad: 0.6,
    },
    relevancia: 0.7,
  },
]
