import { createRouter, createWebHashHistory } from 'vue-router'
// 使用 hash 路由，支持直接以 file:// 打开 html 文件使用
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/tools/sugar',
      name: 'sugar',
      component: () => import('../views/SugarCalcView.vue'),
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

export default router
