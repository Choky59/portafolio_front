<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSession } from '../../composables/useSession'
import { mensajeError } from '../../api/client'

const route = useRoute()
const router = useRouter()
const { iniciar } = useSession()

const username = ref('')
const password = ref('')
const expiration = ref(1)
const enviando = ref(false)
const error = ref(null)

async function enviar() {
  enviando.value = true
  error.value = null
  try {
    await iniciar({ username: username.value, password: password.value, expiration: expiration.value })
    const destino = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/admin')
      ? route.query.redirect
      : '/admin'
    router.replace(destino)
  } catch (err) {
    error.value = err
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <section class="login container">
    <form class="login__form card" @submit.prevent="enviar">
      <h1>Panel</h1>
      <p class="muted">Solo para administrar los sensores.</p>

      <div class="field">
        <label for="usuario">Usuario</label>
        <input id="usuario" v-model.trim="username" class="input" autocomplete="username" required />
      </div>

      <div class="field">
        <label for="clave">Contraseña</label>
        <input
          id="clave"
          v-model="password"
          class="input"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>

      <div class="field">
        <label for="duracion">Mantener la sesión</label>
        <select id="duracion" v-model.number="expiration" class="input">
          <option :value="0">1 hora</option>
          <option :value="1">24 horas</option>
          <option :value="2">7 días</option>
        </select>
      </div>

      <p v-if="error" class="login__error" role="alert">{{ mensajeError(error) }}</p>

      <button type="submit" class="btn" :disabled="enviando">
        {{ enviando ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.login {
  padding-top: 100px;
  padding-bottom: 80px;
}

.login__form {
  max-width: 400px;
  margin: 0 auto;
  padding: 28px 24px;
}

.login__form .btn {
  width: 100%;
}

.login__error {
  color: var(--extremo);
  font-weight: 600;
}
</style>
