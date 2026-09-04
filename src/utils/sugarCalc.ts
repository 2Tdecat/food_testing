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

/* ---------------- 变量校验规则（依据 QB/T 8040-2024） ----------------
 * 面板输入校验与平行样 2 自动生成共用同一份规则，保证生成值满足参考条件 */

/** 蔗糖分称样量 65.000g±0.002（标准 5.4.2） */
export const RULE_SUC_MASS: ValidationRule = {
  min: 64.5,
  max: 65.5,
  warnMin: 64.998,
  warnMax: 65.002,
  message: '称样量应约 65g',
  warnMessage: '标准规定称样量 65.000g±0.002g',
}

/** 检糖计测量范围 −30°Z~+120°Z（标准 5.2.1） */
export const RULE_POLAR: ValidationRule = {
  min: -30,
  max: 120,
  message: '检糖计测量范围 −30°Z~+120°Z',
}

/** 干燥失重 Q */
export const RULE_LOSS: ValidationRule = { min: 0, max: 15, message: '干燥失重应在 0~15 g/100g 之间' }

/** 糖液温度 t */
export const RULE_TEMP: ValidationRule = {
  min: 10,
  max: 35,
  warnMin: 18,
  warnMax: 25,
  message: '温度应在 10~35 ℃ 之间',
  warnMessage: '温度偏离 20℃ 较大，注意温度校正',
}

/** 还原糖称样量约 26g，可视含量增减（标准 6.4.1） */
export const RULE_RED_MASS: ValidationRule = {
  min: 0.1,
  max: 60,
  warnMin: 10,
  warnMax: 45,
  message: '称样量应在 0~60g 之间',
  warnMessage: '标准规定称样量约 26g，可视还原糖含量高低增减',
}

/** 滴定管 50mL（标准 6.2.2） */
export const RULE_VOLUME: ValidationRule = { min: 0, max: 50, message: '滴定管量程 50mL' }

/** 费林溶液浓度校正系数 K（标准 6.3.4.2，K = 标定耗用体积/40） */
export const RULE_K: ValidationRule = {
  min: 0.5,
  max: 2,
  warnMin: 0.95,
  warnMax: 1.2,
  message: '校正系数应在 0.5~2 之间',
  warnMessage: 'K = 标定耗用标准转化糖液体积/40，通常接近 1',
}

/** 还原糖测定用蔗糖分 S */
export const RULE_SUCROSE: ValidationRule = { min: 0, max: 100, message: '蔗糖分应在 0~100 g/100g 之间' }

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

/** 还原糖测定输入（单个平行样，滴定体积只取一次） */
export interface ReducingInput {
  /** 称样质量 m（g），标准规定 26g，可视还原糖含量增减 */
  mass: number | null
  /** 滴定体积 V（mL） */
  v1: number | null
}

/** 还原糖共享输入 */
export interface ReducingSharedInput {
  /** 蔗糖分 S（g/100g），取蔗糖分测定平均值 */
  sucrose: number | null
  /** 费林溶液浓度校正系数 K（= 40/V） */
  k: number | null
}

export interface ReducingResult {
  /** 滴定耗用配制糖液 V（mL） */
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
  const { mass, v1 } = input
  const { sucrose, k } = shared
  if (mass === null || v1 === null || sucrose === null || k === null) return null
  if (mass === 0) return null
  const V = v1
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

/* ---------------- 平行样 2 自动生成 ---------------- */

/** [min, max] 区间随机数 */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** 保留 n 位小数 */
function roundTo(v: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

/** 钳位到 [lo, hi] */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

/** 蔗糖分平行样数据 */
export interface SucroseRunData {
  mass: number | null
  directP: number | null
  invertP: number | null
}

/**
 * 依据平行样 1 生成蔗糖分平行样 2 数据：
 * - 质量在 ±0.002g 内微调（标准 5.4.2），钳位在称样精度范围 65.000g±0.002g 内
 * - 旋光读数保留 2 位小数，钳位在检糖计测量范围（−30~+120°Z）内，
 *   直接/转化读数同向偏移，使 S₂ 与 S₁ 的相对误差 < 0.05%（标准 5.4.5 精密度）
 * 平行样 1 数据不完整时返回 null。
 */
export function genSucroseRun2(
  run1: SucroseRunData,
  shared: SucroseSharedInput,
): SucroseRunData | null {
  if (
    run1.mass === null ||
    run1.directP === null ||
    run1.invertP === null ||
    shared.loss === null ||
    shared.temp === null
  ) {
    return null
  }
  const d1 = run1.directP - run1.invertP
  // 钳位到标准称样精度（warn 范围 65.000±0.002）：满足参考条件且消除舍入越界
  const mass1 = genMass(
    run1.mass,
    0.002,
    RULE_SUC_MASS.warnMin ?? RULE_SUC_MASS.min,
    RULE_SUC_MASS.warnMax ?? RULE_SUC_MASS.max,
  )

  for (let i = 0; i < 20; i++) {
    // 目标相对误差 0.01%~0.03%，留足余量保证 < 0.05%
    const delta = (Math.random() < 0.5 ? -1 : 1) * rand(0.0001, 0.0003)
    const shift = rand(-0.15, 0.15)
    const directP2 = clamp(roundTo(run1.directP + shift, 2), RULE_POLAR.min, RULE_POLAR.max)
    const invertP2 = clamp(roundTo(directP2 - d1 * (1 + delta), 2), RULE_POLAR.min, RULE_POLAR.max)
    const s1 = calcSucrose(run1, shared)?.S
    const s2 = calcSucrose({ mass: mass1, directP: directP2, invertP: invertP2 }, shared)?.S
    if (s1 !== undefined && s2 !== undefined) {
      const stats = duplicateStats(s1, s2)
      if (stats && stats.relErrorPct < 0.05) {
        return { mass: mass1, directP: directP2, invertP: invertP2 }
      }
    }
  }
  // 兜底：读数偏移但保持差值不变，误差仅来自读数舍入
  const directP2 = clamp(roundTo(run1.directP + rand(-0.1, 0.1), 2), RULE_POLAR.min, RULE_POLAR.max)
  return {
    mass: mass1,
    directP: directP2,
    invertP: clamp(roundTo(directP2 - d1, 2), RULE_POLAR.min, RULE_POLAR.max),
  }
}

/** 还原糖平行样数据 */
export interface ReducingRunData {
  mass: number | null
  v1: number | null
}

/**
 * 依据平行样 1 生成还原糖平行样 2 数据：
 * - 质量在 ±0.005g 内微调，钳位在称样量规则范围（0.1~60g）
 * - 滴定体积保留 2 位小数，钳位在滴定管量程（50mL）内，
 *   使 R₂ 与 R₁ 的相对误差 < 15%（标准 6.6 精密度）
 * 平行样 1 数据不完整时返回 null。
 */
export function genReducingRun2(
  run1: ReducingRunData,
  shared: ReducingSharedInput,
): ReducingRunData | null {
  if (run1.mass === null || run1.v1 === null || shared.sucrose === null || shared.k === null) {
    return null
  }
  if (run1.mass === 0 || run1.v1 === 0) return null

  for (let i = 0; i < 20; i++) {
    const mass2 = genMass(run1.mass, 0.005, RULE_RED_MASS.min, RULE_RED_MASS.max)
    // 目标相对误差 0.3%~5%，留足余量保证 < 15%
    const dir = Math.random() < 0.5 ? -1 : 1
    const v2 = clamp(roundTo(run1.v1 * (1 + dir * rand(0.003, 0.05)), 2), RULE_VOLUME.min, RULE_VOLUME.max)
    if (v2 <= 0) continue
    const r1 = calcReducing(run1, shared)?.R
    const r2 = calcReducing({ mass: mass2, v1: v2 }, shared)?.R
    if (r1 !== undefined && r2 !== undefined) {
      const stats = duplicateStats(r1, r2)
      if (stats && stats.relErrorPct < 15) {
        return { mass: mass2, v1: v2 }
      }
    }
  }
  // 兜底：滴定体积直接沿用
  return {
    mass: genMass(run1.mass, 0.005, RULE_RED_MASS.min, RULE_RED_MASS.max),
    v1: clamp(roundTo(run1.v1, 2), RULE_VOLUME.min, RULE_VOLUME.max),
  }
}

/** 在中心值 ±span 内生成 4 位小数的称样质量，钳位在 [lo, hi] 范围内（调用方按需传误差范围或建议范围） */
function genMass(center: number, span: number, lo: number, hi: number): number {
  // 偏移方向随机，避免单侧漂移
  const offset = rand(-span, span)
  return roundTo(clamp(center + offset, lo, hi), 4)
}
