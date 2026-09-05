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
      // 绵白糖蔗糖分-5012 独立计算
      path: '/tools/sugar-sucrose',
      name: 'sugar-sucrose',
      component: () => import('../views/SucroseCalcView.vue'),
    },
    {
      // 红糖还原糖独立计算
      path: '/tools/sugar-reducing',
      name: 'sugar-reducing',
      component: () => import('../views/ReducingCalcView.vue'),
    },
    {
      // 还原糖（正/反滴）独立计算
      path: '/tools/reducing-titration',
      name: 'reducing-titration',
      component: () => import('../views/TitrationCalcView.vue'),
    },
    {
      // 总糖（正/反滴、蔗糖计）独立计算
      path: '/tools/total-sugar',
      name: 'total-sugar',
      component: () => import('../views/TotalSugarCalcView.vue'),
    },
    {
      // 淀粉（1/2法、正/反滴）独立计算
      path: '/tools/starch',
      name: 'starch',
      component: () => import('../views/StarchCalcView.vue'),
    },
    {
      // 干浸出物（密度法）独立计算
      path: '/tools/dry-extract',
      name: 'dry-extract',
      component: () => import('../views/DryExtractCalcView.vue'),
    },
    {
      // 数据导出（按日期范围汇总导出全部类型记录到一个 Excel）
      path: '/data-export',
      name: 'data-export',
      component: () => import('../views/DataExportView.vue'),
    },
    {
      // 历史记录列表（type: sucrose | reducing | reducing-titration | total-sugar | starch | dry-extract）
      path: '/tools/history/:type',
      name: 'history',
      component: () => import('../views/HistoryView.vue'),
    },
    {
      // 历史记录明细/编辑（type: sucrose | reducing | reducing-titration | total-sugar | starch | dry-extract）
      path: '/tools/history/:type/:id',
      name: 'history-detail',
      component: () => import('../views/HistoryDetailView.vue'),
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

export default router
