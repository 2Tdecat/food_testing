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
    id: 'sugar',
    name: '糖分计算',
    description: '蔗糖分（二次旋光法）与还原糖分（兰-艾农恒容法）合并计算',
    path: '/tools/sugar',
    icon: 'calculator',
    keywords: ['糖分', '蔗糖分', '还原糖', '旋光', '绵白糖', '红糖', '赤砂糖', '斐林'],
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
