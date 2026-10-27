<script setup>
/**
 * The analysis' totals as cards (notes, programs, hours, period). Shared by Panorama
 * and the live view on the Resumen tab; `sucesos` adds the cross-outlet counts.
 */
import { computed } from 'vue'
import { fecha } from './catalogo'

const props = defineProps({
  totales: { type: Object, required: true },
  sucesos: { type: Boolean, default: false },
})

const fmt = new Intl.NumberFormat('es-MX')

const tarjetas = computed(() => {
  const t = props.totales
  return [
    { titulo: 'Noticias analizadas', valor: fmt.format(t.notas) },
    // The same happening in several outlets counts once
    ...(props.sucesos && t.eventos
      ? [{ titulo: 'Sucesos distintos', valor: fmt.format(t.eventos) }, { titulo: 'Contados por 2+ medios', valor: fmt.format(t.multimedio ?? 0) }]
      : []),
    { titulo: 'Programas y notas revisados', valor: fmt.format(t.capturas) },
    { titulo: 'Horas de audio y video', valor: fmt.format(t.horasAnalizadas) },
    { titulo: 'Periodo', valor: t.desde ? `${fecha(t.desde)} – ${fecha(t.hasta)}` : '—' },
  ]
})
</script>

<template>
  <ul class="tarjetas">
    <li v-for="t in tarjetas" :key="t.titulo" class="tarjeta card">
      <span class="tarjeta__titulo">{{ t.titulo }}</span>
      <strong class="tarjeta__valor">{{ t.valor }}</strong>
    </li>
  </ul>
</template>

<style scoped>
.tarjetas {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 900px) {
  .tarjetas {
    grid-template-columns: repeat(4, 1fr);
  }
}

.tarjeta {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border-left: 4px solid var(--accent);
}

.tarjeta__titulo {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
}

.tarjeta__valor {
  font-size: 1.4rem;
  line-height: 1.2;
}
</style>
