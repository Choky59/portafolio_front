/**
 * Fills the Content-Security-Policy placeholders in firebase.json before a deploy:
 *   https://TU-API.herokuapp.com  -> origin of VITE_API_URL (required)
 *   https://TU-CDN.example.com    -> CDN_ORIGINS, space/comma separated (optional; removed if empty)
 *
 * Runs in CI on a fresh checkout. Locally:  VITE_API_URL=... node scripts/preparar-firebase.mjs
 * (it edits firebase.json in place, so don't commit the result).
 */
import { readFileSync, writeFileSync } from 'node:fs'

const API_PLACEHOLDER = 'https://TU-API.herokuapp.com'
const CDN_PLACEHOLDER = 'https://TU-CDN.example.com'

function origin(url, nombre) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') throw new Error('debe usar https://')
    return u.origin
  } catch (err) {
    console.error(`${nombre} no es una URL válida (${url}): ${err.message}`)
    process.exit(1)
  }
}

const apiUrl = (process.env.VITE_API_URL || '').trim()
if (!apiUrl) {
  console.error('Falta VITE_API_URL (URL del backend en Heroku).')
  process.exit(1)
}

const apiOrigin = origin(apiUrl, 'VITE_API_URL')
const cdnOrigins = (process.env.CDN_ORIGINS || '')
  .split(/[\s,]+/)
  .filter(Boolean)
  .map((u) => origin(u, 'CDN_ORIGINS'))

const config = JSON.parse(readFileSync('firebase.json', 'utf8'))
let reemplazos = 0

for (const regla of config.hosting.headers) {
  for (const header of regla.headers) {
    if (header.key !== 'Content-Security-Policy') continue

    if (!header.value.includes(API_PLACEHOLDER)) {
      console.error('firebase.json ya no tiene el placeholder de la API; ¿ya se procesó?')
      process.exit(1)
    }

    header.value = header.value
      .replaceAll(API_PLACEHOLDER, apiOrigin)
      .replaceAll(CDN_PLACEHOLDER, cdnOrigins.join(' '))
      .replace(/ {2,}/g, ' ')
      .replace(/ ;/g, ';')
    reemplazos++
    console.log(`CSP: ${header.value}`)
  }
}

if (!reemplazos) {
  console.error('No se encontró la Content-Security-Policy en firebase.json')
  process.exit(1)
}

writeFileSync('firebase.json', JSON.stringify(config, null, 2) + '\n')
