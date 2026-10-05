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

1. En `.env`, pon `VITE_API_URL=https://TU-API.herokuapp.com` y compila con `npm run build`.
2. En `firebase.json`, reemplaza `TU-API.herokuapp.com` y `TU-CDN.example.com` en la CSP por tus dominios reales.
3. Corre `firebase deploy --only hosting`. La primera vez, `firebase use --add` para elegir el proyecto.
4. En el backend, agrega el dominio del sitio a `CORS_ORIGIN`.

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
    secciones/           secciones de la página de proyecto
  views/          Inicio, Proyecto, 404 y admin (login y sensores)
```

## Cómo agregar el Proyecto #2

1. **Contenido (obligatorio).** Crea `portafolio_back/content/proyectos/<slug>.json`. El nombre del archivo es el slug: minúsculas, números y guiones. Copia `se-puede-salir.json` como base, pon `"numero": 2` y despliega el backend. El proyecto aparece solo en el inicio y en la navegación anterior/siguiente. Si el JSON tiene un error, el backend no arranca y te dice qué campo está mal.
   - `videos`: `[{ "titulo": "Parte 1", "youtubeId": "xxxxxxxxxxx" }]`. Se muestran verticales; agrega `"vertical": false` para videos horizontales. Si está vacío, la sección no aparece.
   - `escenas`: `[{ "titulo": "...", "src": "https://cdn/...mp4", "poster": "https://cdn/...jpg" }]`
   - `modelo3d`: `{ "src": "https://cdn/...glb", "poster": "..." }` o `null`.
2. **Portada 3D (opcional).** Crea `src/three/escenas/<slug>.js` con `setup`, `update` y, si hace falta, `setParams` y `dispose` (contrato en `src/three/stage.js`; puedes reutilizar `piezas.js`). Regístrala en `src/three/portadas.js`:
   ```js
   '<slug>': () => import('./escenas/<slug>.js'),
   ```
   Si no la registras, se usa la portada genérica.
3. **Dashboard en vivo (opcional).** Crea `src/components/dashboards/<Nombre>.vue`, regístralo en `src/components/dashboards/index.js` y pon `"enVivo": true` en el JSON. Desde `/admin`, asigna el sensor a ese proyecto.

## Panel de administración

`/admin` (login en `/admin/login`). Desde ahí puedes:
- crear un sensor y obtener su código de vinculación (válido 10 minutos y de un solo uso);
- asignarle un proyecto;
- generar un código nuevo para revincularlo, revocarlo o borrarlo.

El ESP32 canjea el código en `POST /api/devices/claim` y luego envía sus lecturas a `POST /api/telemetria` con el header `Authorization: Device <deviceId>:<secret>`.
