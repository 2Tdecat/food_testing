/**
 * 糖分计算核心逻辑
 *
 * 依据标准：QB/T 8040-2024《赤砂糖试验方法》
 * - 蔗糖分：二次旋光法（第 5 章）
 * - 还原糖分：兰-艾农恒容法（第 6 章）
 *
 * 公式与变量沿用实验室 Excel（"绵白糖蔗糖分-5012"表、"红糖还原糖"表）：
 * - 旋光读数为 200mm 观测管原始读数，×2（即公式中 200 = 100×2）并入公式
 * - 还原糖测定中"蔗糖分"直接取蔗糖分测定的平均值
 */

/** 表2 兰-艾农恒容法测定还原糖校正系数表（QB/T 8040-2024） */
export const F_TABLE: ReadonlyArray<readonly [g1: number, f: number]> = [
  [0, 1.0],
  [2, 0.946],
  [4, 0.912],
  [6, 0.887],
  [8, 0.865],
  [10, 0.849],
  [12, 0.828],
  [14, 0.811],
  [16, 0.802],
  [18, 0.791],
  [20, 0.78],
]

/**
 * 由 G1（滴定耗用配制糖液中含蔗糖量）查表 2 线性插值求校正系数 f。
 * 超出表范围（0~20g）时取端点值并提示。
 */
export function lookupF(g1: number): { f: number; outOfRange: boolean } {
  if (!Number.isFinite(g1)) return { f: Number.NaN, outOfRange: false }
  if (g1 < 0) return { f: F_TABLE[0]?.[1] ?? Number.NaN, outOfRange: true }
  const last = F_TABLE[F_TABLE.length - 1]
  if (last && g1 > last[0]) return { f: last[1], outOfRange: true }
  for (let i = 0; i < F_TABLE.length - 1; i++) {
    const [x1, y1] = F_TABLE[i] ?? [0, Number.NaN]
    const [x2, y2] = F_TABLE[i + 1] ?? [0, Number.NaN]
    if (g1 >= x1 && g1 <= x2) {
      if (x2 === x1) return { f: y1, outOfRange: false }
      return { f: y1 + ((g1 - x1) / (x2 - x1)) * (y2 - y1), outOfRange: false }
    }
  }
  return { f: Number.NaN, outOfRange: false }
}

/** 校验等级 */
export type CheckLevel = 'error' | 'warn'

export interface ValidationRule {
  /** 最小值（超出报 error） */
  min: number
  /** 最大值（超出报 error） */
  max: number
  /** 建议最小值（超出报 warn） */
  warnMin?: number
  /** 建议最大值（超出报 warn） */
  warnMax?: number
  /** 错误提示 */
  message?: string
  /** 建议提示 */
  warnMessage?: string
}

export interface CheckResult {
  level: CheckLevel
  message: string
}

/**
 * 按规则校验数值，返回 undefined 表示通过。
 * 规则依据 QB/T 8040-2024：
 * - 称样量：蔗糖分 65.000g±0.002（5.4.2）；还原糖 26g，可视含量增减（6.4.1）
 * - 检糖计测量范围 −30°Z~+120°Z（5.2.1）
 * - 滴定管 50mL（6.2.2），费林校正系数 K=40/V（6.3.4.2）
 */
export function validateValue(value: number | null, rule: ValidationRule): CheckResult | undefined {
  if (value === null || Number.isNaN(value)) return undefined
  if (value < rule.min || value > rule.max) {
    return { level: 'error', message: rule.message ?? `应在 ${rule.min} ~ ${rule.max} 之间` }
  }
  if (rule.warnMin !== undefined && value < rule.warnMin) {
    return { level: 'warn', message: rule.warnMessage ?? `建议不小于 ${rule.warnMin}` }
  }
  if (rule.warnMax !== undefined && value > rule.warnMax) {
    return { level: 'warn', message: rule.warnMessage ?? `建议不大于 ${rule.warnMax}` }
  }
  return undefined
}

/* ---------------- 蔗糖分（二次旋光法） ---------------- */

/** 蔗糖分测定输入 */
export interface SucroseInput {
  /** 称样质量 m（g），标准规定 65.000g±0.002 */
  mass: number | null
  /** 直接旋光读数 P（°Z，200mm 观测管原始读数） */
  directP: number | null
  /** 转化旋光读数 P'（°Z，200mm 观测管原始读数） */
  invertP: number | null
}

/** 蔗糖分共享输入 */
export interface SucroseSharedInput {
  /** 干燥失重 Q（g/100g） */
  loss: number | null
  /** 糖液温度 t（℃） */
  temp: number | null
}

export interface SucroseResult {
  /** 每 100mL 转化糖液内所含干固物质量 G（g） */
  G: number
  /** 蔗糖分 S（g/100g） */
  S: number
}

/**
 * 公式(2)：G = 13 × (100 − Q) / 100
 */
export function calcSolidFix(loss: number): number {
  return (13 * (100 - loss)) / 100
}

/**
 * 公式(3)：S = 200 × (P − P') / (132.56 − 0.0794 × (13 − G) − 0.53 × (t − 20))
 * （旋光读数为原始读数，×2 已并入系数 200）
 */
export function calcSucrose(input: SucroseInput, shared: SucroseSharedInput): SucroseResult | null {
  const { mass: _mass, directP, invertP } = input
  const { loss, temp } = shared
  if (directP === null || invertP === null || loss === null || temp === null) return null
  const G = calcSolidFix(loss)
  const denominator = 132.56 - 0.0794 * (13 - G) - 0.53 * (temp - 20)
  if (denominator === 0) return null
  const S = (200 * (directP - invertP)) / denominator
  return { G, S }
}

/* ---------------- 还原糖分（兰-艾农恒容法） ---------------- */

/** 还原糖测定输入（单个平行样） */
export interface ReducingInput {
  /** 称样质量 m（g），标准规定 26g，可视还原糖含量增减 */
  mass: number | null
  /** 第一次滴定体积（mL） */
  v1: number | null
  /** 第二次滴定体积（mL） */
  v2: number | null
}

/** 还原糖共享输入 */
export interface ReducingSharedInput {
  /** 蔗糖分 S（g/100g），取蔗糖分测定平均值 */
  sucrose: number | null
  /** 费林溶液浓度校正系数 K（= 40/V） */
  k: number | null
}

export interface ReducingResult {
  /** 滴定耗用配制糖液 V（mL，两次平均） */
  V: number
  /** 100mL 配制糖液含样品质量 m1（g） */
  m1: number
  /** 滴定耗用配制糖液中含蔗糖量 G1（g） */
  G1: number
  /** 由 G1 查表 2 插值所得校正系数 f */
  f: number
  /** G1 是否超出表 2 范围（0~20g） */
  fOutOfRange: boolean
  /** 还原糖分 R（g/100g） */
  R: number
}

/**
 * 公式(5)：G1 = m1 × S × V / 10000
 * 公式(6)：R = 1000 × f × K / (m1 × V)
 * 其中 m1 = m × 100 / 200（100mL 配制糖液含样品质量）
 */
export function calcReducing(
  input: ReducingInput,
  shared: ReducingSharedInput,
): ReducingResult | null {
  const { mass, v1, v2 } = input
  const { sucrose, k } = shared
  if (mass === null || v1 === null || v2 === null || sucrose === null || k === null) return null
  if (mass === 0) return null
  const V = (v1 + v2) / 2
  if (V === 0) return null
  const m1 = (mass / 200) * 100
  const G1 = (m1 * sucrose * V) / 10000
  const { f, outOfRange } = lookupF(G1)
  const R = (1000 * f * k) / (m1 * V)
  return { V, m1, G1, f, fOutOfRange: outOfRange, R }
}

/* ---------------- 平行样统计 ---------------- */

export interface DuplicateStats {
  /** 平均值 */
  avg: number
  /** 相对误差（%，|x1−x2|/平均×100） */
  relErrorPct: number
}

/** 平行样平均值与相对误差；精密度：蔗糖分 ≤0.05%，还原糖 ≤15% */
export function duplicateStats(a: number, b: number): DuplicateStats | null {
  const avg = (a + b) / 2
  if (avg === 0) return null
  return { avg, relErrorPct: (Math.abs(a - b) / avg) * 100 }
}

/** 保留 n 位有效数字 */
export function sigDigits(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '--'
  if (value === 0) return '0'
  const log = Math.floor(Math.log10(Math.abs(value)))
  const decimals = Math.max(0, digits - 1 - log)
  const fixed = value.toFixed(Math.min(decimals, 100))
  return trimZeros(fixed)
}

function trimZeros(s: string): string {
  if (!s.includes('.')) return s
  return s.replace(/0+$/, '').replace(/\.$/, '')
}
