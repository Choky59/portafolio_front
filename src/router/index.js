import { createRouter, createWebHistory } from 'vue-router'
import InicioView from '../views/InicioView.vue'
import { setHead } from '../composables/useHead'
import { useSession } from '../composables/useSession'

const routes = [
  {
    path: '/',
    name: 'inicio',
    component: InicioView,
    meta: {
      title: 'Jorge García · Proyectos de hardware y software',
      description:
        'Ingeniero en Mecatrónica en Hermosillo. Haciendo proyectos de hardware y software hasta que una empresa me contacte.',
    },
  },
  {
    // Title/description come from the project itself (ProyectoView)
    path: '/proyectos/:slug',
    name: 'proyecto',
    component: () => import('../views/ProyectoView.vue'),
  },
  {
    path: '/admin/login',
    name: 'login',
    component: () => import('../views/admin/LoginView.vue'),
    meta: { title: 'Entrar · Panel', noindex: true },
  },
  {
    // Shared shell (session + section menu). Children inherit `requiereSesion`.
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { noindex: true, requiereSesion: true },
    children: [
      {
        path: '',
        name: 'admin-inicio',
        component: () => import('../views/admin/AdminInicioView.vue'),
        meta: { title: 'Panel' },
      },
      {
        path: 'sensores',
        name: 'admin-sensores',
        component: () => import('../views/admin/SensoresView.vue'),
        meta: { title: 'Sensores · Panel' },
      },
      {
        path: 'archivos',
        name: 'admin-archivos',
        component: () => import('../views/admin/ArchivosView.vue'),
        meta: { title: 'Archivos · Panel' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'no-encontrado',
    component: () => import('../views/NotFoundView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 72 }
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const { asegurar } = useSession()

  if (to.meta.requiereSesion && !(await asegurar())) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && (await asegurar())) {
    return { name: 'admin-inicio' }
  }
})

router.afterEach((to) => {
  if (to.meta.title) {
    setHead({ title: to.meta.title, description: to.meta.description, noindex: to.meta.noindex })
  }
})
