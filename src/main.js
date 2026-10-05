import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { setOnUnauthorized } from './api/client'
import { limpiarSesion } from './composables/useSession'

import './styles/tokens.css'
import './styles/base.css'

// An admin call answered 401 (session expired or closed elsewhere): back to login
setOnUnauthorized(() => {
  limpiarSesion()
  const actual = router.currentRoute.value
  if (actual.meta.requiereSesion) {
    router.replace({ name: 'login', query: { redirect: actual.fullPath } })
  }
})

createApp(App).use(router).mount('#app')
