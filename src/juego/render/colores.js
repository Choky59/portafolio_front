/**
 * The game world's colors. They don't follow the site's light/dark theme: the map is
 * desert in daylight either way.
 */
export const COLORES = {
  tinta: '#22170F',
  crema: '#F1E6CC',
  arena: '#D9BF8C',
  arenaOscura: '#C9AB74',
  tierra: '#B48A57',
  asfalto: '#4B413A',
  orilla: '#E8D9B6',
  linea: '#F4B33A',
  saguaro: '#5E8F6E',
  saguaroClaro: '#7FB7A4',
  piedra: '#9A8B78',
  muro: '#A89B8A',
  sombra: 'rgba(34, 23, 15, 0.28)',
  polvo: '#C9AB74',
  humo: '#E8E2D4',
}

// Car colors are part of the protocol (the server validates them): one list for both sides
import { COLORES as COLORES_CARRO } from '../compartido/protocolo'
export { COLORES_CARRO }

/** Hex color of a car color id */
export function colorCarro(id) {
  return (COLORES_CARRO.find((c) => c.id === id) ?? COLORES_CARRO[0]).color
}
