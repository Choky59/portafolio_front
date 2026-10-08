/**
 * "Sobre mí" content (SobreMiView). Edit the text here; the template only lays it out.
 */
export const perfil = {
  nombreCompleto: 'Jorge Andrés García Montiel',
  origen: 'Hermosillo, Sonora',
  resumen:
    'Ingeniero en Mecatrónica por el Tec de Monterrey, con 8 años en Innovación y Desarrollo. Diseño circuitos desde el prototipo hasta el producto final y escribo el software que los conecta: firmware, servidores, páginas web y apps móviles.',

  disponible: {
    titulo: 'Disponible para nuevas oportunidades',
    texto: 'Busco un equipo donde seguir desarrollando soluciones a problemas reales, del prototipo al producto.',
  },

  historia: [
    'Hice esta página porque quiero que se vea lo que se puede construir. Aunque los proyectos sean sencillos, se parecen mucho a lo que pasa en la industria: un sensor que manda datos a un servidor tiene los mismos retos que una planta que monitorea sus máquinas o una ciudad que controla su alumbrado.',
    'Me gusta el ciclo completo: entender la necesidad, armar el prototipo, llevarlo a un producto que funcione solo y explicarlo claro. Lo mismo sirve para automatizar un proceso y reducir errores que para desarrollar una tecnología nueva que cubra una necesidad.',
  ],

  experiencia: [
    {
      puesto: 'Innovación y Desarrollo',
      anios: 8,
      descripcion:
        'Ocho años convirtiendo ideas en productos: de la investigación y el prototipo al diseño final, en hardware y software.',
      logros: [
        'Proyectos de automatización de ciudades (smart city).',
        'Diseño del circuito que permite a San Pedro Garza García monitorear y controlar sus luminarias públicas.',
        'Aplicaciones móviles publicadas en la App Store y en Google Play.',
        'Automatización de procesos para reducir errores y desarrollo de nuevas tecnologías.',
      ],
    },
  ],

  educacion: [
    {
      titulo: 'Ingeniería en Mecatrónica',
      escuela: 'Tecnológico de Monterrey',
      descripcion: 'Durante la carrera trabajé en proyectos de robótica y automatización:',
      proyectos: [
        {
          titulo: 'Simulación de líneas de producción con robot Baxter',
          texto: 'Programé un robot colaborativo para reproducir tareas de una línea de manufactura industrial.',
        },
        {
          titulo: 'Prototipo de vehículo lunar con Arduino',
          texto:
            'Diseñé y construí un vehículo pensado para operar en condiciones de superficie lunar, integrando motores, sensores y control embebido.',
        },
      ],
    },
  ],

  proyectosDestacados: [
    {
      titulo: 'Alumbrado público inteligente',
      lugar: 'San Pedro Garza García, N.L.',
      descripcion:
        'Diseñé el circuito que permite a la ciudad monitorear y controlar sus luminarias públicas a distancia: saber cuáles están encendidas o fallando y operarlas sin mandar a nadie a la calle.',
      temas: ['Diseño de circuitos', 'Smart city', 'Monitoreo remoto'],
    },
    {
      titulo: 'Apps móviles',
      lugar: 'iOS y Android',
      descripcion:
        'Desarrollé aplicaciones móviles que cumplen los requisitos de Apple y Google y están publicadas en la App Store y en Google Play.',
      temas: ['App Store', 'Google Play', 'Apps móviles'],
    },
  ],

  skills: [
    {
      titulo: 'Electrónica y hardware',
      items: [
        'Diseño de circuitos, de prototipo a producto final',
        'PCB tallada con CNC',
        'ESP32 / Arduino',
        'Sensores',
        'Baterías de litio y módulos de carga',
        'Gestión de energía (deep sleep)',
        'Impresión 3D de carcasas',
      ],
    },
    {
      titulo: 'Firmware (C++)',
      items: [
        'WiFi y HTTPS con certificado raíz',
        'Memoria NVS y RTC',
        'JSON en microcontroladores',
        'Vinculación segura de dispositivos',
      ],
    },
    {
      titulo: 'Backend',
      items: [
        'Node.js',
        'TypeScript',
        'Express',
        'MongoDB',
        'APIs REST',
        'Autenticación y sesiones',
        'Seguridad (Helmet, rate limiting, validación)',
        'Llaves por dispositivo con hash SHA-256',
        'Google Cloud Storage',
        'Pruebas automáticas (Jest, Supertest)',
        'Deploy en Heroku',
      ],
    },
    {
      titulo: 'Frontend',
      items: [
        'Vue 3',
        'Vue Router',
        'Vite',
        'Escenas 3D con Three.js',
        'Diseño responsivo y accesible',
        'Modo claro / oscuro',
        'Firebase Hosting',
        'Content-Security-Policy',
      ],
    },
    {
      titulo: 'Apps móviles',
      items: ['iOS (App Store)', 'Android (Google Play)'],
    },
    {
      titulo: 'Industria',
      items: [
        'Automatización de procesos',
        'Robótica colaborativa (Baxter)',
        'Reducción de errores',
        'Smart city',
        'Alumbrado público inteligente',
        'Desarrollo de nuevas tecnologías',
        'De la idea al producto',
      ],
    },
  ],

  pasatiempos: [
    {
      titulo: 'Drones',
      texto: 'Soy aficionado a los drones. Subo los videos de mis vuelos a Instagram.',
      link: { texto: '@ovejaBoladora', url: 'https://www.instagram.com/ovejaBoladora/' },
    },
    {
      titulo: 'Natación',
      texto: 'Nadar es mi manera de despejarme y mantenerme en forma.',
    },
  ],
}
