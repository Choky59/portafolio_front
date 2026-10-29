/**
 * Copies the game's shared module (physics, track, types) and its data (circuits, items)
 * from portafolio_back, which is the source of truth, into src/juego.
 * The copies are committed: Firebase's CI doesn't have the back repo.
 *
 *   npm run juego:sync     copy
 *   npm run juego:check    fail if the copies are out of date
 *
 * JUEGO_BACK_DIR overrides where the back repo is (default ../portafolio_back).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const back = path.resolve(raiz, process.env.JUEGO_BACK_DIR ?? '../portafolio_back')
const CABECERA = '// GENERADO por scripts/juego-sync.mjs desde portafolio_back: no editar aquí.\n'

const copias = [
  { desde: path.join(back, 'src/juego/compartido'), hacia: path.join(raiz, 'src/juego/compartido'), ext: '.ts' },
  { desde: path.join(back, 'content/juego'), hacia: path.join(raiz, 'src/juego/datos'), ext: '.json' },
]

const revisar = process.argv.includes('--check')

if (!existsSync(back)) {
  console.error(`No encuentro portafolio_back en ${back} (usa JUEGO_BACK_DIR)`)
  process.exit(1)
}

/** Every file with the extension under `dir`, as paths relative to it */
function archivos(dir, ext, base = dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name)
    if (e.isDirectory()) return archivos(ruta, ext, base)
    return e.name.endsWith(ext) ? [path.relative(base, ruta)] : []
  })
}

const hash = (texto) => createHash('sha256').update(texto).digest('hex')
const contenido = (ext, texto) => (ext === '.ts' ? CABECERA + texto : texto)

let diferencias = 0
for (const { desde, hacia, ext } of copias) {
  const fuente = archivos(desde, ext)
  const copia = archivos(hacia, ext)

  for (const rel of fuente) {
    const esperado = contenido(ext, readFileSync(path.join(desde, rel), 'utf8'))
    const destino = path.join(hacia, rel)
    const actual = existsSync(destino) ? readFileSync(destino, 'utf8') : null
    if (actual !== null && hash(actual) === hash(esperado)) continue
    diferencias++
    if (revisar) {
      console.error(`Desactualizado: ${path.relative(raiz, destino)}`)
    } else {
      mkdirSync(path.dirname(destino), { recursive: true })
      writeFileSync(destino, esperado)
      console.log(`Copiado: ${path.relative(raiz, destino)}`)
    }
  }

  // Files that no longer exist in the back
  for (const rel of copia.filter((r) => !fuente.includes(r))) {
    diferencias++
    if (revisar) console.error(`Sobra: ${path.relative(raiz, path.join(hacia, rel))}`)
    else rmSync(path.join(hacia, rel))
  }
}

if (revisar && diferencias) {
  console.error('Corre `npm run juego:sync`.')
  process.exit(1)
}
console.log(diferencias ? `${diferencias} cambio(s).` : 'El juego ya está sincronizado.')
