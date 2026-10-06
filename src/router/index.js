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
    // Project page: one layout (loads the project once) + one route per tab.
    // Titles come from the project itself (useHeadSeccion in each tab).
    path: '/proyectos/:slug',
    component: () => import('../views/proyecto/ProyectoLayout.vue'),
    meta: { pestanasProyecto: true },
    children: [
      { path: '', name: 'proyecto', component: () => import('../views/proyecto/ResumenView.vue') },
      { path: 'videos', name: 'proyecto-videos', component: () => import('../views/proyecto/VideosView.vue') },
      { path: 'videos/:video', name: 'proyecto-video', component: () => import('../views/proyecto/VideoView.vue') },
      { path: 'como-funciona', name: 'proyecto-como-funciona', component: () => import('../views/proyecto/ComoFuncionaView.vue') },
      { path: 'materiales', name: 'proyecto-materiales', component: () => import('../views/proyecto/MaterialesView.vue') },
      { path: 'codigo', name: 'proyecto-codigo', component: () => import('../views/proyecto/CodigoView.vue') },
    ],
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
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 72 }

    // Switching tabs inside the same project: show the new tab from its start, right under
    // the sticky tab bar, instead of jumping back to the 3D header. If the user hasn't
    // scrolled into the content yet, don't move at all.
    if (to.meta.pestanasProyecto && from.meta.pestanasProyecto && to.params.slug === from.params.slug) {
      const BARRAS = 60 + 48 // fixed top bar + sticky tab bar
      const contenido = document.getElementById('contenido-seccion')
      if (contenido && contenido.getBoundingClientRect().top < BARRAS) {
        return { el: '#contenido-seccion', top: BARRAS }
      }
      return false
    }

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
