/** 工具库功能入口注册表 */

export interface ToolItem {
  /** 唯一标识 */
  id: string
  /** 功能名称 */
  name: string
  /** 功能描述 */
  description: string
  /** 路由路径 */
  path: string
  /** tdesign 图标名 */
  icon: string
  /** 搜索关键词 */
  keywords: string[]
}

export const tools: ToolItem[] = [
  {
    id: 'sugar-sucrose',
    name: '绵白糖红糖蔗糖分',
    description: '蔗糖分测定（二次旋光法），含历史记录与 Excel 导出',
    path: '/tools/sugar-sucrose',
    icon: 'chart-line-data',
    keywords: ['绵白糖', '红糖', '蔗糖分', '旋光', '5012', '糖分'],
  },
  {
    id: 'sugar-reducing',
    name: '红糖还原糖',
    description: '还原糖分测定（兰-艾农恒容法），含历史记录与 Excel 导出',
    path: '/tools/sugar-reducing',
    icon: 'chart-pie',
    keywords: ['红糖', '还原糖', '斐林', '兰艾农', '糖分'],
  },
]

/** 按关键词搜索工具（匹配名称/描述/关键词） */
export function searchTools(query: string): ToolItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return tools
  return tools.filter((t) =>
    [t.name, t.description, ...t.keywords].some((s) => s.toLowerCase().includes(q)),
  )
}
