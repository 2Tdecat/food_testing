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
export const RULE_LOSS: ValidationRule = {
  min: 0,
  max: 15,
  message: '干燥失重应在 0~15 g/100g 之间',
}

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
export const RULE_SUCROSE: ValidationRule = {
  min: 0,
  max: 100,
  message: '蔗糖分应在 0~100 g/100g 之间',
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

/* ---------------- 还原糖（正滴/反滴滴定） ---------------- */

/** 滴定模式：direct=正滴（直接滴定），back=反滴（反滴定） */
export type TitrationMode = 'direct' | 'back'

/**
 * 标定G量：滴定管读数（量程 50mL，参照滴定管规格）。
 * 实验室现有数据约 11~12mL（见 糖.xlsx"还原糖正滴/反滴"表）。
 */
export const RULE_TITR_G: ValidationRule = {
  min: 0,
  max: 50,
  message: '标定G量应在 0~50 之间（滴定管量程）',
}

/** 滴定称样量：实验室现有数据约 2~5g */
export const RULE_TITR_MASS: ValidationRule = {
  min: 0.1,
  max: 60,
  warnMin: 1,
  warnMax: 20,
  message: '称样量应在 0.1~60g 之间',
  warnMessage: '常见称样量约 2~5g，可视还原糖含量高低增减',
}

/** 稀释倍数（正滴模式使用） */
export const RULE_DILUTION: ValidationRule = {
  min: 1,
  max: 100,
  warnMax: 10,
  message: '稀释倍数应不小于 1',
  warnMessage: '稀释倍数通常为 1、2、4 等较小的整数',
}

/** 还原糖滴定平行样输入（单个平行样） */
export interface TitrationInput {
  /** 称样量 m（g） */
  mass: number | null
  /** 滴定量 V（mL） */
  volume: number | null
}

/** 还原糖滴定共享输入 */
export interface TitrationSharedInput {
  /** 滴定模式 */
  mode: TitrationMode
  /** 标定G量（mL） */
  g: number | null
  /** 稀释倍数（仅正滴模式使用） */
  dilution: number | null
  /**
   * 定容体积（mL，仅正滴模式使用）：250（默认）或 100。
   * 原 Excel 中 L 列以"定250"/"定100"标注，对应公式中的定容体积常数。
   */
  flaskVolume?: number | null
}

/** 正滴默认定容体积（mL），与原 Excel 绝大多数数据一致 */
export const DEFAULT_FLASK_VOLUME = 250

/**
 * 糖含量（g/100g），公式与实验室 Excel（糖.xlsx）一致：
 * - 正滴：ROUND(G量 × 100 × 稀释倍数 × 定容体积 / (称样量 × 滴定量 × 1000), 2)，
 *   定容体积为 250（"定250"）或 100（"定100"）
 * - 反滴：(G量 − 滴定量) × 250 × 100 / (称样量 × 10 × 1000)
 * 250 为试样定容体积（mL）；1000 为 mg→g 换算。
 */
export function calcTitration(input: TitrationInput, shared: TitrationSharedInput): number | null {
  const { mass, volume } = input
  const { mode, g, dilution } = shared
  if (mass === null || volume === null || g === null) return null
  if (mass === 0 || volume === 0) return null
  if (mode === 'direct') {
    if (dilution === null) return null
    const flask = shared.flaskVolume ?? DEFAULT_FLASK_VOLUME
    return Math.round(((g * 100 * dilution * flask) / (mass * volume * 1000)) * 100) / 100
  }
  return ((g - volume) * 250 * 100) / (mass * 10 * 1000)
}

/** 还原糖滴定平行样统计（误差/质量差保留符号，与原 Excel 公式一致） */
export interface TitrationStats {
  /** 平均值 */
  avg: number
  /** 误差（%，(含量₁ − 含量₂)/平均 × 100，有符号） */
  relErrorPct: number
  /** 质量差（含量₁ − 含量₂，有符号） */
  massDiff: number
}

/**
 * 精密度要求：正滴（直接滴定法）≤5%、反滴 ≤10%。
 * 依据 GB 5009.7-2016 精密度条款：第一法（直接滴定法）5%，其余方法 10%。
 */
export function titrationPrecisionLimit(mode: TitrationMode): number {
  return mode === 'direct' ? 5 : 10
}

/** 平行样平均值/误差/质量差；平均值为 0 时返回 null */
export function titrationStats(c1: number, c2: number): TitrationStats | null {
  const avg = (c1 + c2) / 2
  if (avg === 0) return null
  return { avg, relErrorPct: ((c1 - c2) / avg) * 100, massDiff: c1 - c2 }
}

/** 还原糖滴定平行样数据 */
export interface TitrationRunData {
  mass: number | null
  volume: number | null
}

/**
 * 依据平行样 1 生成还原糖滴定平行样 2 数据：
 * - 质量在 ±0.005g 内微调，钳位在称样量规则范围（0.1~60g）
 * - 滴定量按 0.3%~5% 偏移，保留 2 位小数，钳位滴定管量程（0~50mL）；
 *   反滴模式下滴定量还须小于标定G量（否则含量为负）
 * - 使两平行样糖含量相对误差满足精密度（正滴 <5%，反滴 <10%）
 * 平行样 1 数据不完整时返回 null。
 */
export function genTitrationRun2(
  run1: TitrationRunData,
  shared: TitrationSharedInput,
): TitrationRunData | null {
  if (run1.mass === null || run1.volume === null || shared.g === null) return null
  if (shared.mode === 'direct' && shared.dilution === null) return null
  if (run1.mass === 0 || run1.volume === 0) return null
  const limit = titrationPrecisionLimit(shared.mode)

  for (let i = 0; i < 20; i++) {
    const mass2 = genMass(run1.mass, 0.005, RULE_TITR_MASS.min, RULE_TITR_MASS.max)
    const dir = Math.random() < 0.5 ? -1 : 1
    const v2 = clamp(
      roundTo(run1.volume * (1 + dir * rand(0.003, 0.05)), 2),
      RULE_VOLUME.min,
      RULE_VOLUME.max,
    )
    if (v2 <= 0) continue
    // 反滴模式滴定量必须小于标定G量，否则糖含量为负
    if (shared.mode === 'back' && v2 >= shared.g) continue
    const c1 = calcTitration(run1, shared)
    const c2 = calcTitration({ mass: mass2, volume: v2 }, shared)
    if (c1 !== null && c2 !== null) {
      const s = titrationStats(c1, c2)
      if (s && Math.abs(s.relErrorPct) < limit) {
        return { mass: mass2, volume: v2 }
      }
    }
  }
  // 兜底：滴定量直接沿用
  return {
    mass: genMass(run1.mass, 0.005, RULE_TITR_MASS.min, RULE_TITR_MASS.max),
    volume: clamp(roundTo(run1.volume, 2), RULE_VOLUME.min, RULE_VOLUME.max),
  }
}

/* ---------------- 总糖（正/反滴，可选蔗糖计） ---------------- */

/** 总糖滴定模式：direct=正滴（直接滴定），back=反滴（反滴定） */
export type TotalSugarMode = 'direct' | 'back'

/** 总糖默认定容体积（mL），原 Excel 绝大多数数据为 250，少数为 200 */
export const TOTAL_SUGAR_DEFAULT_FLASK = 250

/** 总糖默认取用体积（mL），原 Excel 四表公式中固定为 50 */
export const TOTAL_SUGAR_DEFAULT_USE_VOLUME = 50

/** 总糖取用体积（mL）：滴定所取试样定容溶液的体积，原表公式固定为 50 */
export const RULE_TOTAL_SUGAR_USE_VOLUME: ValidationRule = {
  min: 1,
  max: 250,
  message: '取用体积应在 1~250 mL 之间',
}

/** 总糖滴定平行样输入（单个平行样） */
export interface TotalSugarInput {
  /** 称样量 m（g） */
  mass: number | null
  /** 滴定量 V（mL） */
  volume: number | null
}

/** 总糖滴定共享输入 */
export interface TotalSugarSharedInput {
  /** 滴定模式 */
  mode: TotalSugarMode
  /** 是否启用蔗糖计（×0.95，对应原 Excel 带"（蔗糖计）"的表） */
  sucroseBasis: boolean
  /** 标定G量（mL） */
  g: number | null
  /** 稀释倍数（仅正滴模式使用） */
  dilution: number | null
  /** 定容体积（mL）：250（默认）或 200 */
  flaskVolume?: number | null
  /** 取用体积（mL）：滴定所取试样定容溶液的体积，默认 50 */
  useVolume?: number | null
}

/**
 * 模拟 Excel ROUND 的十进制舍入（半值远离零）：
 * 先以 toPrecision(15) 消除浮点噪声（如 92.44999999999999 → 92.45），
 * 再按绝对值四舍五入，避免 JS Math.round 的二进制半值偏差。
 */
function excelRound(v: number, digits: number): number {
  if (!Number.isFinite(v)) return v
  const p = Number(Math.abs(v).toPrecision(15))
  const f = 10 ** digits
  const r = Math.round(p * f + Number.EPSILON * f) / f
  return v < 0 ? -r : r
}

/**
 * 总糖含量（g/100g），公式与实验室 Excel（糖.xlsx）四表一致：
 * - 正滴：ROUND(G量 × 100 × 稀释倍数 × 定容 × 100 / (取用体积 × 称样量 × 滴定量 × 1000), 2)
 * - 正滴（蔗糖计）：ROUND(G量 × 100 × 稀释倍数 × 100 × 定容 / (称样量 × 滴定量 × 取用体积 × 1000) × 0.95, 2)
 * - 反滴：(G量 − 滴定量) × 定容 × 100 × 100 / (称样量 × 10 × 1000 × 取用体积)
 * - 反滴（蔗糖计）：(G量 − 滴定量) × 定容 × 100 × 0.95 × 100 / (取用体积 × 称样量 × 10 × 1000)
 * 取用体积默认 50（原表公式固定值）；正滴保留 2 位小数，反滴不取整（与原表一致）。
 */
export function calcTotalSugar(
  input: TotalSugarInput,
  shared: TotalSugarSharedInput,
): number | null {
  const { mass, volume } = input
  const { mode, sucroseBasis, g, dilution } = shared
  if (mass === null || volume === null || g === null) return null
  if (mass === 0 || volume === 0) return null
  const flask = shared.flaskVolume ?? TOTAL_SUGAR_DEFAULT_FLASK
  const useVol = shared.useVolume ?? TOTAL_SUGAR_DEFAULT_USE_VOLUME
  if (mode === 'direct') {
    if (dilution === null) return null
    if (sucroseBasis) {
      return excelRound(
        ((g * 100 * dilution * 100 * flask) / mass / volume / useVol / 1000) * 0.95,
        2,
      )
    }
    return excelRound((g * 100 * dilution * flask * 100) / useVol / mass / volume / 1000, 2)
  }
  if (sucroseBasis) {
    return ((g - volume) * flask * 100 * 0.95 * 100) / useVol / mass / 10 / 1000
  }
  return ((g - volume) * flask * 100 * 100) / mass / 10 / 1000 / useVol
}

/** 总糖平行样统计 */
export interface TotalSugarStats {
  /** 平均值 */
  avg: number
  /** 误差（%，有符号） */
  relErrorPct: number
  /** 质量差（有符号） */
  massDiff: number
}

/**
 * 总糖平行样统计，取整规则与原 Excel 四表一致：
 * - 正滴（含蔗糖计）：平均值 ROUND(…,1)；误差 = (含量₁−含量₂)×100/取整后平均值（不取整）；
 *   质量差 = 含量₂ − 含量₁（原表 L 列公式 H'−H）
 * - 反滴：平均值不取整；误差 ROUND(…,1)；质量差 = 含量₁ − 含量₂（原表 J 列公式 G−G'）
 * - 反滴（蔗糖计）：平均值/误差均不取整
 * 平均值为 0 时返回 null。
 */
export function totalSugarStats(
  mode: TotalSugarMode,
  sucroseBasis: boolean,
  c1: number,
  c2: number,
): TotalSugarStats | null {
  const avg = (c1 + c2) / 2
  if (avg === 0) return null
  const rawErr = ((c1 - c2) * 100) / avg
  if (mode === 'direct') {
    // 正滴表 I 列为 ROUND(…,1)，J 列误差除以取整后的平均值
    const avgR = excelRound(avg, 1)
    if (avgR === 0) return null
    return { avg: avgR, relErrorPct: ((c1 - c2) * 100) / avgR, massDiff: c2 - c1 }
  }
  if (sucroseBasis) {
    return { avg, relErrorPct: rawErr, massDiff: c1 - c2 }
  }
  return { avg, relErrorPct: excelRound(rawErr, 1), massDiff: c1 - c2 }
}

/** 总糖滴定平行样数据 */
export interface TotalSugarRunData {
  mass: number | null
  volume: number | null
}

/**
 * 依据平行样 1 生成总糖平行样 2 数据：
 * - 质量在 ±0.005g 内微调，钳位在称样量规则范围（0.1~60g）
 * - 滴定量按 0.3%~5% 偏移，保留 2 位小数，钳位滴定管量程（0~50mL）；
 *   反滴模式下滴定量还须小于标定G量（否则含量为负）
 * - 使两平行样含量误差满足精密度（正滴 <5%，反滴 <10%）
 * 平行样 1 数据不完整时返回 null。
 */
export function genTotalSugarRun2(
  run1: TotalSugarRunData,
  shared: TotalSugarSharedInput,
): TotalSugarRunData | null {
  if (run1.mass === null || run1.volume === null || shared.g === null) return null
  if (shared.mode === 'direct' && shared.dilution === null) return null
  if (run1.mass === 0 || run1.volume === 0) return null
  const limit = titrationPrecisionLimit(shared.mode)

  for (let i = 0; i < 20; i++) {
    const mass2 = genMass(run1.mass, 0.005, RULE_TITR_MASS.min, RULE_TITR_MASS.max)
    const dir = Math.random() < 0.5 ? -1 : 1
    const v2 = clamp(
      roundTo(run1.volume * (1 + dir * rand(0.003, 0.05)), 2),
      RULE_VOLUME.min,
      RULE_VOLUME.max,
    )
    if (v2 <= 0) continue
    if (shared.mode === 'back' && v2 >= shared.g) continue
    const c1 = calcTotalSugar(run1, shared)
    const c2 = calcTotalSugar({ mass: mass2, volume: v2 }, shared)
    if (c1 !== null && c2 !== null) {
      const s = totalSugarStats(shared.mode, shared.sucroseBasis, c1, c2)
      if (s && Math.abs(s.relErrorPct) < limit) {
        return { mass: mass2, volume: v2 }
      }
    }
  }
  // 兜底：滴定量直接沿用
  return {
    mass: genMass(run1.mass, 0.005, RULE_TITR_MASS.min, RULE_TITR_MASS.max),
    volume: clamp(roundTo(run1.volume, 2), RULE_VOLUME.min, RULE_VOLUME.max),
  }
}

/* ---------------- 淀粉（1/2法、正/反滴） ---------------- */

/** 淀粉滴定模式：direct=正滴（直接滴定），back=反滴（反滴定） */
export type StarchMode = 'direct' | 'back'

/** 淀粉测定方法：1=一法（原表"淀粉一法/淀粉1法反滴"），2=二法（原表"淀粉二法/淀粉2反滴"） */
export type StarchMethod = 1 | 2

/** 淀粉默认定容体积（mL），原 Excel 绝大多数数据为 250 */
export const STARCH_DEFAULT_FLASK = 250

/** 淀粉滴定平行样输入（单个平行样） */
export interface StarchInput {
  /** 称样量 m（g） */
  mass: number | null
  /** 滴定量 V（mL） */
  volume: number | null
}

/** 淀粉滴定共享输入 */
export interface StarchSharedInput {
  /** 滴定模式 */
  mode: StarchMode
  /** 测定方法：1=一法，2=二法 */
  method: StarchMethod
  /** 标定G量（mL） */
  g: number | null
  /** 稀释倍数（正滴两法与反滴2法使用，反滴1法不使用） */
  dilution: number | null
  /** 定容体积（mL）：正滴 250/200，反滴1法固定 250，反滴2法 250/500 */
  flaskVolume?: number | null
}

/**
 * 淀粉含量（g/100g），公式与实验室 Excel（糖.xlsx）四个淀粉表一致：
 * - 淀粉一法（正滴）：ROUND(G量 × 100 × 稀释 × 定容 × 100 × 0.9 / (50 × 称样量 × 滴定量 × 1000), 2)
 * - 淀粉二法（正滴）：G量 × 100 × 稀释 × 定容 × 0.9 / (称样量 × 滴定量 × 1000)，不取整
 * - 淀粉1法反滴：(G量 − 滴定量) × 250 × 100 × 100 × 0.9 / (称样量 × 10 × 1000 × 50)，
 *   定容固定 250，不取整
 * - 淀粉2反滴：(G量 − 滴定量) × 定容 × 100 × 稀释 × 0.9 / (称样量 × 10 × 1000)，不取整
 */
export function calcStarch(input: StarchInput, shared: StarchSharedInput): number | null {
  const { mass, volume } = input
  const { mode, method, g, dilution } = shared
  if (mass === null || volume === null || g === null) return null
  if (mass === 0 || volume === 0) return null
  if (mode === 'direct') {
    if (dilution === null) return null
    const flask = shared.flaskVolume ?? STARCH_DEFAULT_FLASK
    if (method === 1) {
      return excelRound((g * 100 * dilution * flask * 100 * 0.9) / 50 / mass / volume / 1000, 2)
    }
    return (g * 100 * dilution * flask * 0.9) / mass / volume / 1000
  }
  if (method === 1) {
    return ((g - volume) * 250 * 100 * 100 * 0.9) / mass / 10 / 1000 / 50
  }
  if (dilution === null) return null
  const flask = shared.flaskVolume ?? STARCH_DEFAULT_FLASK
  return ((g - volume) * flask * 100 * dilution * 0.9) / mass / 10 / 1000
}

/** 淀粉平行样统计 */
export interface StarchStats {
  /** 平均值 */
  avg: number
  /** 误差（%，有符号） */
  relErrorPct: number
}

/**
 * 淀粉平行样统计，取整规则与原 Excel 四表一致：
 * - 淀粉一法：平均值 ROUND(…,1)；误差 = (含量₁−含量₂)×100/取整后平均值（不取整）
 * - 淀粉二法 / 淀粉2反滴：平均值、误差均不取整
 * - 淀粉1法反滴：平均值不取整；误差 ROUND(…,1)
 * 平均值为 0 时返回 null。
 */
export function starchStats(
  mode: StarchMode,
  method: StarchMethod,
  c1: number,
  c2: number,
): StarchStats | null {
  const avg = (c1 + c2) / 2
  if (avg === 0) return null
  if (mode === 'direct' && method === 1) {
    // 一法表 H 列为 ROUND(…,1)，I 列误差除以取整后的平均值
    const avgR = excelRound(avg, 1)
    if (avgR === 0) return null
    return { avg: avgR, relErrorPct: ((c1 - c2) * 100) / avgR }
  }
  if (mode === 'back' && method === 1) {
    return { avg, relErrorPct: excelRound(((c1 - c2) * 100) / avg, 1) }
  }
  return { avg, relErrorPct: ((c1 - c2) * 100) / avg }
}

/** 淀粉滴定平行样数据 */
export interface StarchRunData {
  mass: number | null
  volume: number | null
}

/**
 * 依据平行样 1 生成淀粉平行样 2 数据：
 * - 质量在 ±0.005g 内微调，钳位在称样量规则范围（0.1~60g）
 * - 滴定量按 0.3%~5% 偏移，保留 2 位小数，钳位滴定管量程（0~50mL）；
 *   反滴模式下滴定量还须小于标定G量（否则含量为负）
 * - 使两平行样含量误差满足精密度（正滴 <5%，反滴 <10%）
 * 平行样 1 数据不完整时返回 null。
 */
export function genStarchRun2(
  run1: StarchRunData,
  shared: StarchSharedInput,
): StarchRunData | null {
  if (run1.mass === null || run1.volume === null || shared.g === null) return null
  const needsDilution = shared.mode === 'direct' || (shared.mode === 'back' && shared.method === 2)
  if (needsDilution && shared.dilution === null) return null
  if (run1.mass === 0 || run1.volume === 0) return null
  const limit = titrationPrecisionLimit(shared.mode)

  for (let i = 0; i < 20; i++) {
    const mass2 = genMass(run1.mass, 0.005, RULE_TITR_MASS.min, RULE_TITR_MASS.max)
    const dir = Math.random() < 0.5 ? -1 : 1
    const v2 = clamp(
      roundTo(run1.volume * (1 + dir * rand(0.003, 0.05)), 2),
      RULE_VOLUME.min,
      RULE_VOLUME.max,
    )
    if (v2 <= 0) continue
    // 反滴模式滴定量必须小于标定G量，否则含量为负
    if (shared.mode === 'back' && v2 >= shared.g) continue
    const c1 = calcStarch(run1, shared)
    const c2 = calcStarch({ mass: mass2, volume: v2 }, shared)
    if (c1 !== null && c2 !== null) {
      const s = starchStats(shared.mode, shared.method, c1, c2)
      if (s && Math.abs(s.relErrorPct) < limit) {
        return { mass: mass2, volume: v2 }
      }
    }
  }
  // 兜底：滴定量直接沿用
  return {
    mass: genMass(run1.mass, 0.005, RULE_TITR_MASS.min, RULE_TITR_MASS.max),
    volume: clamp(roundTo(run1.volume, 2), RULE_VOLUME.min, RULE_VOLUME.max),
  }
}

/* ---------------- 干浸出物（密度法，GB/T 15038-2006 第 4.3 章） ---------------- */

/** 原液/蒸馏液密度（g/mL）：20℃ 密度瓶法测定，实验室现有数据约 0.94~1.10 */
export const RULE_DE_DENSITY: ValidationRule = {
  min: 0.9,
  max: 1.2,
  message: '密度应在 0.9~1.2 g/mL 之间',
  warnMessage: '密度通常为 4 位小数（20℃ 密度瓶法）',
}

/** 总干浸出物（g/L）：由脱醇样密度查 GB/T 15038 附录 C 对照表所得 */
export const RULE_DE_TOTAL_EXTRACT: ValidationRule = {
  min: 0,
  max: 500,
  message: '总干浸出物应在 0~500 g/L 之间',
}

/** 总糖/还原糖（g/L） */
export const RULE_DE_SUGAR: ValidationRule = {
  min: 0,
  max: 500,
  message: '糖含量应在 0~500 g/L 之间',
}

/** 干浸出物平行样输入（单个平行样） */
export interface DryExtractRunInput {
  /** 原液密度（g/mL） */
  densityOriginal: number | null
  /** 蒸馏液密度（g/mL） */
  densityDistilled: number | null
  /** 总干浸出物（g/L，由脱醇样密度查表所得） */
  totalExtract: number | null
}

/** 干浸出物共享输入 */
export interface DryExtractSharedInput {
  /** 总糖（g/L） */
  totalSugar: number | null
  /** 还原糖（g/L） */
  reducingSugar: number | null
  /**
   * 干浸出物结果是否保留 2 位小数。
   * 原 Excel"干浸出物"表存在两种公式形态：
   * `=F-H-I`（多数行）与 `=ROUND(F-H-I,2)`（第 12~35 行），此处按记录保存以完整复现两表。
   */
  roundResult?: boolean
}

export interface DryExtractResult {
  /** 脱醇样密度（g/mL，E 列） */
  density: number
  /** 蔗糖（g/L，I 列） */
  sucrose: number
  /** 干浸出物（g/L，J 列） */
  dryExtract: number
}

/**
 * 公式与实验室 Excel（15038糖11.xlsx"干浸出物"表）一致：
 * - 脱醇样密度：ROUND(((原液密度×1000 − 蒸馏液密度×1000) + 1000)/1000, 4)
 * - 蔗糖：(总糖 − 还原糖) × 0.95（不取整，与原表 I 列一致）
 * - 干浸出物：总干浸出物 − 还原糖 − 蔗糖（默认不取整；roundResult 时保留 2 位小数）
 */
export function calcDryExtract(
  input: DryExtractRunInput,
  shared: DryExtractSharedInput,
): DryExtractResult | null {
  const { densityOriginal, densityDistilled, totalExtract } = input
  const { totalSugar, reducingSugar } = shared
  if (
    densityOriginal === null ||
    densityDistilled === null ||
    totalExtract === null ||
    totalSugar === null ||
    reducingSugar === null
  ) {
    return null
  }
  const density = excelRound((densityOriginal * 1000 - densityDistilled * 1000 + 1000) / 1000, 4)
  const sucrose = (totalSugar - reducingSugar) * 0.95
  const raw = totalExtract - reducingSugar - sucrose
  return { density, sucrose, dryExtract: shared.roundResult ? excelRound(raw, 2) : raw }
}

/** 干浸出物平行样统计 */
export interface DryExtractStats {
  /** 平均值 */
  avg: number
  /** 误差（%，(干浸出物₁ − 干浸出物₂)/平均 × 100，有符号） */
  relErrorPct: number
}

/**
 * 干浸出物精密度：重复性条件下两次独立测定结果的绝对差值
 * 不得超过算术平均值的 2%（GB/T 15038-2006 4.3.5）。
 */
export const DRY_EXTRACT_PRECISION_LIMIT = 2

/** 平行样平均值与误差；平均值为 0 时返回 null */
export function dryExtractStats(c1: number, c2: number): DryExtractStats | null {
  const avg = (c1 + c2) / 2
  if (avg === 0) return null
  return { avg, relErrorPct: ((c1 - c2) / avg) * 100 }
}

/**
 * 依据平行样 1 生成干浸出物平行样 2 数据：
 * - 原液/蒸馏液密度在 ±0.0005 g/mL 内微调，保留 4 位小数，钳位密度规则范围
 * - 总干浸出物微调幅度受精密度约束（|Δ| ≤ 1.8% × |干浸出物₁|），
 *   保留 1 位小数（查表值粒度），钳位 0~500 g/L；干浸出物绝对值过小
 *   （<约 5.6 g/L）时无法在查表粒度内偏移，沿用平行样 1 的总干浸出物
 * - 使两平行样干浸出物误差满足精密度（≤2%）
 * 平行样 1 数据不完整时返回 null。
 */
export function genDryExtractRun2(
  run1: DryExtractRunInput,
  shared: DryExtractSharedInput,
): DryExtractRunInput | null {
  if (
    run1.densityOriginal === null ||
    run1.densityDistilled === null ||
    run1.totalExtract === null ||
    shared.totalSugar === null ||
    shared.reducingSugar === null
  ) {
    return null
  }
  const c1 = calcDryExtract(run1, shared)
  if (c1 === null) return null
  // 密度对干浸出物无直接影响（仅经查表间接影响总干浸出物），误差由总干浸出物偏移决定
  const span = Math.floor(Math.abs(c1.dryExtract) * 0.018 * 10) / 10

  for (let i = 0; i < 20; i++) {
    const densityOriginal = genDensity(run1.densityOriginal)
    const densityDistilled = genDensity(run1.densityDistilled)
    let delta = 0
    if (span >= 0.1) delta = roundTo(rand(0.1, Math.min(span, 0.5)), 1)
    const dir = Math.random() < 0.5 ? -1 : 1
    const totalExtract = clamp(
      roundTo(run1.totalExtract + dir * delta, 1),
      RULE_DE_TOTAL_EXTRACT.min,
      RULE_DE_TOTAL_EXTRACT.max,
    )
    const c2 = calcDryExtract({ densityOriginal, densityDistilled, totalExtract }, shared)
    if (c2 !== null) {
      const s = dryExtractStats(c1.dryExtract, c2.dryExtract)
      if (s && Math.abs(s.relErrorPct) < DRY_EXTRACT_PRECISION_LIMIT) {
        return { densityOriginal, densityDistilled, totalExtract }
      }
    }
  }
  // 兜底：总干浸出物直接沿用（误差为 0），密度仍微调
  return {
    densityOriginal: genDensity(run1.densityOriginal),
    densityDistilled: genDensity(run1.densityDistilled),
    totalExtract: roundTo(
      clamp(run1.totalExtract, RULE_DE_TOTAL_EXTRACT.min, RULE_DE_TOTAL_EXTRACT.max),
      1,
    ),
  }
}

/** 在中心值 ±0.0005 内生成 4 位小数的密度，钳位在密度规则范围内 */
function genDensity(center: number): number {
  for (let i = 0; i < 8; i++) {
    const offset = roundTo(rand(-0.0005, 0.0005), 4)
    const d = roundTo(clamp(center + offset, RULE_DE_DENSITY.min, RULE_DE_DENSITY.max), 4)
    if (Math.abs(d - center) <= 0.0005) return d
  }
  return roundTo(clamp(center, RULE_DE_DENSITY.min, RULE_DE_DENSITY.max), 4)
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
    const v2 = clamp(
      roundTo(run1.v1 * (1 + dir * rand(0.003, 0.05)), 2),
      RULE_VOLUME.min,
      RULE_VOLUME.max,
    )
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
  // 偏移方向随机，避免单侧漂移；保留 4 位小数后须仍在 ±span 内，否则重试
  for (let i = 0; i < 8; i++) {
    const offset = roundTo(rand(-span, span), 4)
    const m = roundTo(clamp(center + offset, lo, hi), 4)
    if (Math.abs(m - center) <= span) return m
  }
  return roundTo(clamp(center, lo, hi), 4)
}
