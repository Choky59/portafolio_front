<script setup>
import { config } from '../config'
import { perfil } from '../data/perfil'
</script>

<template>
  <header class="encabezado container">
    <div v-if="perfil.disponible" class="disponible">
      <p class="disponible__titulo">{{ perfil.disponible.titulo }}</p>
      <p class="disponible__texto">{{ perfil.disponible.texto }}</p>
      <a
        v-if="config.whatsappPropuestaUrl"
        class="btn disponible__btn"
        :href="config.whatsappPropuestaUrl"
        target="_blank"
        rel="noopener"
      >
        Contáctame por WhatsApp
      </a>
    </div>

    <p class="encabezado__etiqueta">Sobre mí</p>
    <h1>{{ perfil.nombreCompleto }}</h1>
    <p class="muted">{{ perfil.origen }}</p>
    <p class="encabezado__resumen">{{ perfil.resumen }}</p>

    <div class="acciones">
      <a v-if="config.cvUrl" class="btn" :href="config.cvUrl" target="_blank" rel="noopener">Ver mi CV</a>
      <a
        v-if="config.whatsappUrl"
        class="btn btn--ghost"
        :href="config.whatsappUrl"
        target="_blank"
        rel="noopener"
      >
        Escríbeme por WhatsApp
      </a>
      <RouterLink class="btn btn--ghost" to="/#proyectos">Ver proyectos</RouterLink>
    </div>
  </header>

  <section class="section container" aria-labelledby="titulo-historia">
    <h2 id="titulo-historia">Por qué esta página</h2>
    <div class="historia">
      <p v-for="(parrafo, i) in perfil.historia" :key="i">{{ parrafo }}</p>
    </div>
  </section>

  <section class="section container" aria-labelledby="titulo-trayectoria">
    <h2 id="titulo-trayectoria">Trayectoria</h2>
    <div class="grid grid--2">
      <article v-for="e in perfil.experiencia" :key="e.puesto" class="tarjeta">
        <p class="tarjeta__meta">Experiencia · {{ e.anios }} años</p>
        <h3>{{ e.puesto }}</h3>
        <p>{{ e.descripcion }}</p>
        <ul class="logros">
          <li v-for="l in e.logros" :key="l">{{ l }}</li>
        </ul>
      </article>

      <article v-for="ed in perfil.educacion" :key="ed.titulo" class="tarjeta">
        <p class="tarjeta__meta">Educación</p>
        <h3>{{ ed.titulo }}</h3>
        <p>{{ ed.escuela }}</p>
        <template v-if="ed.proyectos">
          <p>{{ ed.descripcion }}</p>
          <ul class="logros">
            <li v-for="p in ed.proyectos" :key="p.titulo">
              <strong>{{ p.titulo }}:</strong> {{ p.texto }}
            </li>
          </ul>
        </template>
      </article>
    </div>
  </section>

  <section class="section container" aria-labelledby="titulo-destacados">
    <h2 id="titulo-destacados">Proyectos destacados en la industria</h2>
    <div class="grid grid--2">
      <article v-for="p in perfil.proyectosDestacados" :key="p.titulo" class="tarjeta">
        <p class="tarjeta__meta">{{ p.lugar }}</p>
        <h3>{{ p.titulo }}</h3>
        <p>{{ p.descripcion }}</p>
        <ul class="chips">
          <li v-for="t in p.temas" :key="t" class="chip">{{ t }}</li>
        </ul>
      </article>
    </div>
  </section>

  <section class="section container" aria-labelledby="titulo-skills">
    <h2 id="titulo-skills">Skills</h2>
    <div class="grid grid--3">
      <article v-for="g in perfil.skills" :key="g.titulo" class="tarjeta">
        <h3>{{ g.titulo }}</h3>
        <ul class="chips">
          <li v-for="s in g.items" :key="s" class="chip">{{ s }}</li>
        </ul>
      </article>
    </div>
  </section>

  <section class="section container" aria-labelledby="titulo-pasatiempos">
    <h2 id="titulo-pasatiempos">Fuera del trabajo</h2>
    <div class="grid grid--2">
      <article v-for="p in perfil.pasatiempos" :key="p.titulo" class="tarjeta">
        <h3>{{ p.titulo }}</h3>
        <p>{{ p.texto }}</p>
        <a v-if="p.link" :href="p.link.url" target="_blank" rel="noopener">{{ p.link.texto }}</a>
      </article>
    </div>
  </section>

  <section class="section container cierre" aria-labelledby="titulo-cierre">
    <h2 id="titulo-cierre">¿Tu empresa necesita algo así?</h2>
    <p class="muted">Platiquemos sobre el problema que quieres resolver.</p>
    <div class="acciones acciones--centro">
      <a
        v-if="config.whatsappPropuestaUrl"
        class="btn"
        :href="config.whatsappPropuestaUrl"
        target="_blank"
        rel="noopener"
      >
        Contáctame por WhatsApp
      </a>
      <a v-if="config.cvUrl" class="btn btn--ghost" :href="config.cvUrl" target="_blank" rel="noopener">Ver mi CV</a>
    </div>
  </section>
</template>

<style scoped>
.encabezado {
  padding-top: 100px;
  padding-bottom: 32px;
}

.disponible {
  background: var(--accent);
  color: var(--on-accent);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  margin-bottom: 28px;
}

.disponible__titulo {
  font-weight: 700;
  margin: 0 0 4px;
}

.disponible__texto {
  margin: 0;
}

/* Inverted button: the banner already uses the accent as background */
.disponible__btn {
  margin-top: 14px;
  background: var(--on-accent);
  border-color: var(--on-accent);
  color: var(--accent);
}

.encabezado__etiqueta {
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-ink);
  margin: 0;
}

.encabezado h1 {
  margin: 6px 0 4px;
}

.encabezado__resumen {
  max-width: 40rem;
  font-size: 1.1rem;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.acciones--centro {
  justify-content: center;
}

.historia {
  max-width: 44rem;
}

.grid {
  display: grid;
  gap: 18px;
  margin-top: 20px;
  grid-template-columns: 1fr;
}

@media (min-width: 680px) {
  .grid--2,
  .grid--3 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1040px) {
  .grid--3 {
    grid-template-columns: repeat(3, 1fr);
  }
}

.tarjeta {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.tarjeta p:last-child {
  margin-bottom: 0;
}

.tarjeta__meta {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
  margin: 0 0 4px;
}

.logros {
  margin: 0;
  padding-left: 1.2em;
}

.logros li + li {
  margin-top: 6px;
}

.cierre {
  text-align: center;
}
</style>
