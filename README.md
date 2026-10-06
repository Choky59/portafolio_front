# portafolio_front

Sitio del portafolio de Jorge García: Vue 3 + Vite + Vue Router + Three.js, en JavaScript. Consume la API de [`portafolio_back`](../portafolio_back).

## Desarrollo

```bash
npm install
cp .env.example .env      # CV y WhatsApp; VITE_API_URL vacío en desarrollo
npm run dev:full          # backend (:3000) + front (:5173), con las dos carpetas como hermanas
# o solo el front:  npm run dev
```

En desarrollo, Vite manda `/api` al backend en `localhost:3000` (proxy), así que no hay CORS.

| Script | Qué hace |
|---|---|
| `npm run dev` | Vite en http://localhost:5173 |
| `npm run dev:full` | Backend y front juntos |
| `npm run build` | Compila a `dist/` |
| `npm run preview` | Sirve `dist/` para probar el build |

## Producción (Firebase Hosting)

Cada push a `main` despliega solo con [`.github/workflows/deploy-firebase.yml`](.github/workflows/deploy-firebase.yml) al proyecto `proyectos-andres`. También se puede lanzar a mano desde la pestaña **Actions** → **Run workflow**.

Hay que configurar en GitHub (**Settings → Secrets and variables → Actions**):

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `FIREBASE_SERVICE_ACCOUNT` | JSON de una cuenta de servicio con el rol *Firebase Hosting Admin* |
| Variable | `VITE_API_URL` | URL del backend en Heroku |
| Variable | `VITE_CV_URL`, `VITE_WHATSAPP` | Opcionales |
| Variable | `CDN_ORIGINS` | Opcional: dónde viven los MP4 y .glb |

`firebase.json` trae placeholders en la CSP (`TU-API...`, `TU-CDN...`). El workflow los llena con `scripts/preparar-firebase.mjs` antes de publicar, así que no hay que editarlos a mano.

En el backend, `CORS_ORIGIN` debe incluir `https://proyectos-andres.web.app,https://proyectos-andres.firebaseapp.com`.

## Estructura

```
src/
  api/            fetch a la API (client.js maneja errores y el header de sesión)
  composables/    useApi, usePolling, useVisible, useReducedMotion, useTheme, useSession, useHead
  three/          Three.js en JS puro, sin Vue
    stage.js      renderer, tamaño, devicePixelRatio, loop y limpieza
    piezas.js     saguaro, sol, termómetro, suelo y montañas low-poly
    escenas/      una escena por archivo (contrato descrito en stage.js)
    portadas.js   registro slug → escena de portada
  components/
    ThreeCanvas.vue      monta una escena: solo corre visible y respeta el movimiento reducido
    dashboards/          registro slug → dashboard en vivo
    secciones/           bloques de contenido (materiales, pasos, código…)
    proyecto/            pestañas, tarjeta de video y artículo técnico
  views/
    proyecto/            página de proyecto: layout + una vista por pestaña
    admin/               panel (login, sensores, archivos)
```

## Página de proyecto

Cada proyecto se divide en pestañas, y cada pestaña tiene su propia URL (se puede compartir y Atrás funciona):

| Pestaña | URL | Contenido |
|---|---|---|
| Resumen | `/proyectos/<slug>` | Dashboard en vivo, problema/solución/resultado y retos |
| Videos | `/proyectos/<slug>/videos` | Lista de partes (y escenas) |
| Video | `/proyectos/<slug>/videos/<video>` | Reproductor + artículo técnico |
| Cómo funciona | `/proyectos/<slug>/como-funciona` | Pasos + modelo 3D |
| Materiales | `/proyectos/<slug>/materiales` | Materiales + paso a paso |
| Código | `/proyectos/<slug>/codigo` | Código + descargas |

Las pestañas sin contenido no aparecen. `ProyectoLayout.vue` carga el proyecto una sola vez y lo comparte con las pestañas (`useProyecto()`).

## Cómo agregar el Proyecto #2

1. **Contenido (obligatorio).** Crea `portafolio_back/content/proyectos/<slug>.json`. El nombre del archivo es el slug: minúsculas, números y guiones. Copia `se-puede-salir.json` como base, pon `"numero": 2` y despliega el backend. El proyecto aparece solo en el inicio y en la navegación anterior/siguiente. Si el JSON tiene un error, el backend no arranca y te dice qué campo está mal.
   - `escenas`: `[{ "titulo": "...", "src": "https://cdn/...mp4", "poster": "https://cdn/...jpg" }]`
   - `modelo3d`: `{ "src": "https://cdn/...glb", "poster": "..." }` o `null`.
2. **Portada 3D (opcional).** Crea `src/three/escenas/<slug>.js` con `setup`, `update` y, si hace falta, `setParams` y `dispose` (contrato en `src/three/stage.js`; puedes reutilizar `piezas.js`). Regístrala en `src/three/portadas.js`:
   ```js
   '<slug>': () => import('./escenas/<slug>.js'),
   ```
   Si no la registras, se usa la portada genérica.
3. **Dashboard en vivo (opcional).** Crea `src/components/dashboards/<Nombre>.vue`, regístralo en `src/components/dashboards/index.js` y pon `"enVivo": true` en el JSON. Desde `/admin/sensores`, asigna el sensor a ese proyecto.

## Cómo agregar un video a un proyecto

Cada video es un archivo propio, `portafolio_back/content/proyectos/<slug>/videos/<video>.json`. El nombre del archivo es el slug del video y forma parte de su URL. Agregar un video es agregar un archivo:

```json
{
  "slug": "mi-video",
  "parte": 3,
  "titulo": "Título del video",
  "resumen": "Una o dos líneas.",
  "duracion": "1:30",
  "src": "https://firebasestorage.googleapis.com/…",
  "temas": ["ESP32", "Backend"],
  "articulo": [
    { "titulo": "Primer tema", "texto": "Párrafo uno.\n\nPárrafo dos.", "puntos": ["Detalle opcional"] }
  ]
}
```

- **Fuente del video:** `src` es el MP4. Súbelo en `/admin/archivos` y usa **Copiar para JSON**. También puedes usar `youtubeId` en su lugar. Sin ninguno de los dos, la página muestra "Video próximamente".
- **Orden:** `parte` define el orden y no se puede repetir.
- **Opcionales:** `poster` (imagen) y `"vertical": false` para videos horizontales.
- **Errores:** si el archivo tiene un error, el backend no arranca y te dice qué archivo y qué campo revisar.

## Panel de administración

Login en `/admin/login`. Cada sección del panel es una ruta hija de `/admin`, dentro de `AdminLayout.vue`, que se encarga de la sesión y del menú. `/admin` es el inicio del panel, con una tarjeta para entrar a cada sección.

Para agregar una sección:
1. Agrega una ruta hija en `src/router/index.js`.
2. Agrega su pestaña en `secciones` dentro de `src/views/admin/AdminLayout.vue`.
3. Agrega su tarjeta en `src/views/admin/AdminInicioView.vue`.

### Archivos (`/admin/archivos`)
Placeholder del gestor de archivos para Firebase Storage.

### Sensores (`/admin/sensores`)
- Crear un sensor y obtener su código de vinculación (válido 10 minutos y de un solo uso).
- Asignarle un proyecto.
- Generar un código nuevo para revincularlo, revocarlo o borrarlo.

El ESP32 canjea el código en `POST /api/devices/claim` y luego envía sus lecturas a `POST /api/telemetria` con el header `Authorization: Device <deviceId>:<secret>`.
