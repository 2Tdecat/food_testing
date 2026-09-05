/**
 * 计算历史记录本地存储（localStorage）
 *
 * 每种计算各自独立一份历史：
 * - 'sucrose'           ：绵白糖蔗糖分-5012
 * - 'reducing'          ：红糖还原糖
 * - 'reducing-titration'：还原糖（正/反滴）
 * - 'total-sugar'        ：总糖（正/反滴、蔗糖计）
 * - 'starch'             ：淀粉（1/2法、正/反滴）
 * - 'dry-extract'        ：干浸出物（密度法）
 */

import type { StarchMethod, StarchMode, TitrationMode, TotalSugarMode } from './sugarCalc'

export type HistoryType =
  | 'sucrose'
  | 'reducing'
  | 'reducing-titration'
  | 'total-sugar'
  | 'starch'
  | 'dry-extract'

/** 蔗糖分测定记录 */
export interface SucroseRunInput {
  mass: number | null
  directP: number | null
  invertP: number | null
}

export interface SucroseRecord {
  id: string
  /** 保存时间（ISO 字符串） */
  savedAt: string
  /** 样品名称（如 绵白糖、红糖） */
  sampleName: string
  /** 样品编号 */
  sampleNo: string
  /** 干燥失重 Q */
  loss: number
  /** 糖液温度 t */
  temp: number
  /** 两个平行样 */
  runs: [SucroseRunInput, SucroseRunInput]
  /** 干固物重 G */
  G: number
  /** 蔗糖分 S1、S2 */
  S1: number
  S2: number
  /** 平均值 */
  avg: number
  /** 相对误差（%） */
  relErrorPct: number
}

/** 还原糖测定记录 */
export interface ReducingRunInput {
  mass: number | null
  v1: number | null
}

export interface ReducingRecord {
  id: string
  savedAt: string
  sampleName: string
  sampleNo: string
  /** 蔗糖分 S（计算时采用值） */
  sucrose: number
  /** 费林试剂校正系数 K */
  k: number
  runs: [ReducingRunInput, ReducingRunInput]
  /** 各平行样计算结果（与 runs 顺序对应） */
  calc: [
    { V: number; m1: number; G1: number; f: number; R: number },
    { V: number; m1: number; G1: number; f: number; R: number },
  ]
  /** 平均值 */
  avg: number
  /** 相对误差（%） */
  relErrorPct: number
}

/** 还原糖（正/反滴）平行样输入 */
export interface TitrationRunInput {
  mass: number | null
  volume: number | null
}

/** 还原糖（正/反滴）测定记录 */
export interface TitrationRecord {
  id: string
  savedAt: string
  sampleName: string
  sampleNo: string
  /** 滴定模式：direct=正滴，back=反滴 */
  mode: TitrationMode
  /** 标定G量 */
  g: number
  /** 稀释倍数（正滴模式使用，反滴为 null） */
  dilution: number | null
  /** 定容体积 mL（正滴模式：250/100，反滴为 null；旧记录缺省按 250 处理） */
  flaskVolume?: number | null
  runs: [TitrationRunInput, TitrationRunInput]
  /** 各平行样糖含量（g/100g，与 runs 顺序对应） */
  content: [number, number]
  /** 平均值 */
  avg: number
  /** 误差（%，有符号） */
  relErrorPct: number
  /** 质量差（有符号） */
  massDiff: number
}

/** 总糖（正/反滴、蔗糖计）平行样输入 */
export interface TotalSugarRunInput {
  mass: number | null
  volume: number | null
}

/** 总糖（正/反滴、蔗糖计）测定记录 */
export interface TotalSugarRecord {
  id: string
  savedAt: string
  sampleName: string
  sampleNo: string
  /** 滴定模式：direct=正滴，back=反滴 */
  mode: TotalSugarMode
  /** 是否启用蔗糖计（×0.95） */
  sucroseBasis: boolean
  /** 标定G量 */
  g: number
  /** 稀释倍数（正滴模式使用，反滴为 null） */
  dilution: number | null
  /** 定容体积 mL（250 或 200，缺省按 250 处理） */
  flaskVolume?: number | null
  /** 取用体积 mL（滴定所取试样定容溶液体积，缺省按 50 处理） */
  useVolume?: number | null
  runs: [TotalSugarRunInput, TotalSugarRunInput]
  /** 各平行样糖含量（g/100g，与 runs 顺序对应） */
  content: [number, number]
  /** 平均值（正滴按原表保留 1 位小数，反滴不取整） */
  avg: number
  /** 误差（%，有符号；反滴（非蔗糖计）按原表保留 1 位小数） */
  relErrorPct: number
  /** 质量差（有符号；正滴 = 含量₂−含量₁，反滴 = 含量₁−含量₂，与原表公式方向一致） */
  massDiff: number
}

/** 淀粉（1/2法、正/反滴）平行样输入 */
export interface StarchRunInput {
  mass: number | null
  volume: number | null
}

/** 淀粉（1/2法、正/反滴）测定记录 */
export interface StarchRecord {
  id: string
  savedAt: string
  sampleName: string
  sampleNo: string
  /** 滴定模式：direct=正滴，back=反滴 */
  mode: StarchMode
  /** 测定方法：1=一法，2=二法 */
  method: StarchMethod
  /** 标定G量 */
  g: number
  /** 稀释倍数（反滴1法为 null） */
  dilution: number | null
  /** 定容体积 mL（250 默认；正滴 200 变体；反滴2法 500 变体；反滴1法固定 250） */
  flaskVolume?: number | null
  runs: [StarchRunInput, StarchRunInput]
  /** 各平行样淀粉含量（g/100g，与 runs 顺序对应） */
  content: [number, number]
  /** 平均值（一法按原表保留 1 位小数，其余不取整） */
  avg: number
  /** 误差（%，有符号；1法反滴按原表保留 1 位小数） */
  relErrorPct: number
}

/** 干浸出物（密度法）平行样输入 */
export interface DryExtractRunInput {
  densityOriginal: number | null
  densityDistilled: number | null
  totalExtract: number | null
}

/** 干浸出物（密度法）测定记录 */
export interface DryExtractRecord {
  id: string
  savedAt: string
  sampleName: string
  sampleNo: string
  /** 总糖（g/L，两平行样共享） */
  totalSugar: number
  /** 还原糖（g/L，两平行样共享） */
  reducingSugar: number
  /** 干浸出物结果是否保留 2 位小数（原表 ROUND(…,2) 公式变体） */
  roundResult: boolean
  runs: [DryExtractRunInput, DryExtractRunInput]
  /** 各平行样干浸出物（g/L，与 runs 顺序对应） */
  content: [number, number]
  /** 平均值 */
  avg: number
  /** 误差（%，有符号） */
  relErrorPct: number
}

const STORAGE_KEY: Record<HistoryType, string> = {
  sucrose: 'lab_history_sucrose',
  reducing: 'lab_history_reducing',
  'reducing-titration': 'lab_history_reducing_titration',
  'total-sugar': 'lab_history_total_sugar',
  starch: 'lab_history_starch',
  'dry-extract': 'lab_history_dry_extract',
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadHistory(
  type: HistoryType,
):
  | SucroseRecord[]
  | ReducingRecord[]
  | TitrationRecord[]
  | TotalSugarRecord[]
  | StarchRecord[]
  | DryExtractRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY[type])
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function persist(type: HistoryType, records: unknown[]): void {
  localStorage.setItem(STORAGE_KEY[type], JSON.stringify(records))
}

export function addSucroseRecord(record: Omit<SucroseRecord, 'id' | 'savedAt'>): SucroseRecord {
  const full: SucroseRecord = { ...record, id: genId(), savedAt: new Date().toISOString() }
  const list = loadHistory('sucrose') as SucroseRecord[]
  list.unshift(full)
  persist('sucrose', list)
  return full
}

export function addReducingRecord(record: Omit<ReducingRecord, 'id' | 'savedAt'>): ReducingRecord {
  const full: ReducingRecord = { ...record, id: genId(), savedAt: new Date().toISOString() }
  const list = loadHistory('reducing') as ReducingRecord[]
  list.unshift(full)
  persist('reducing', list)
  return full
}

export function addTitrationRecord(
  record: Omit<TitrationRecord, 'id' | 'savedAt'>,
): TitrationRecord {
  const full: TitrationRecord = { ...record, id: genId(), savedAt: new Date().toISOString() }
  const list = loadHistory('reducing-titration') as TitrationRecord[]
  list.unshift(full)
  persist('reducing-titration', list)
  return full
}

export function addTotalSugarRecord(
  record: Omit<TotalSugarRecord, 'id' | 'savedAt'>,
): TotalSugarRecord {
  const full: TotalSugarRecord = { ...record, id: genId(), savedAt: new Date().toISOString() }
  const list = loadHistory('total-sugar') as TotalSugarRecord[]
  list.unshift(full)
  persist('total-sugar', list)
  return full
}

export function addStarchRecord(record: Omit<StarchRecord, 'id' | 'savedAt'>): StarchRecord {
  const full: StarchRecord = { ...record, id: genId(), savedAt: new Date().toISOString() }
  const list = loadHistory('starch') as StarchRecord[]
  list.unshift(full)
  persist('starch', list)
  return full
}

export function addDryExtractRecord(
  record: Omit<DryExtractRecord, 'id' | 'savedAt'>,
): DryExtractRecord {
  const full: DryExtractRecord = { ...record, id: genId(), savedAt: new Date().toISOString() }
  const list = loadHistory('dry-extract') as DryExtractRecord[]
  list.unshift(full)
  persist('dry-extract', list)
  return full
}

export function deleteRecord(type: HistoryType, id: string): void {
  deleteRecords(type, [id])
}

/** 批量删除记录 */
export function deleteRecords(type: HistoryType, ids: string[]): void {
  if (ids.length === 0) return
  const idSet = new Set(ids)
  const list = loadHistory(type) as { id: string }[]
  const rest = list.filter((r) => !idSet.has(r.id))
  if (rest.length !== list.length) persist(type, rest)
}

/** 按 id 查找记录 */
export function getRecord(
  type: HistoryType,
  id: string,
):
  | SucroseRecord
  | ReducingRecord
  | TitrationRecord
  | TotalSugarRecord
  | StarchRecord
  | DryExtractRecord
  | null {
  const list = loadHistory(type) as (
    | SucroseRecord
    | ReducingRecord
    | TitrationRecord
    | TotalSugarRecord
    | StarchRecord
    | DryExtractRecord
  )[]
  return list.find((r) => r.id === id) ?? null
}

/** 更新蔗糖分记录（保留原 id 与保存时间），未找到返回 false */
export function updateSucroseRecord(
  id: string,
  record: Omit<SucroseRecord, 'id' | 'savedAt'>,
): boolean {
  const list = loadHistory('sucrose') as SucroseRecord[]
  const idx = list.findIndex((r) => r.id === id)
  const old = idx >= 0 ? list[idx] : undefined
  if (!old) return false
  list[idx] = { ...old, ...record, id, savedAt: old.savedAt }
  persist('sucrose', list)
  return true
}

/** 更新还原糖记录（保留原 id 与保存时间），未找到返回 false */
export function updateReducingRecord(
  id: string,
  record: Omit<ReducingRecord, 'id' | 'savedAt'>,
): boolean {
  const list = loadHistory('reducing') as ReducingRecord[]
  const idx = list.findIndex((r) => r.id === id)
  const old = idx >= 0 ? list[idx] : undefined
  if (!old) return false
  list[idx] = { ...old, ...record, id, savedAt: old.savedAt }
  persist('reducing', list)
  return true
}

/** 更新还原糖（正/反滴）记录（保留原 id 与保存时间），未找到返回 false */
export function updateTitrationRecord(
  id: string,
  record: Omit<TitrationRecord, 'id' | 'savedAt'>,
): boolean {
  const list = loadHistory('reducing-titration') as TitrationRecord[]
  const idx = list.findIndex((r) => r.id === id)
  const old = idx >= 0 ? list[idx] : undefined
  if (!old) return false
  list[idx] = { ...old, ...record, id, savedAt: old.savedAt }
  persist('reducing-titration', list)
  return true
}

/** 更新总糖记录（保留原 id 与保存时间），未找到返回 false */
export function updateTotalSugarRecord(
  id: string,
  record: Omit<TotalSugarRecord, 'id' | 'savedAt'>,
): boolean {
  const list = loadHistory('total-sugar') as TotalSugarRecord[]
  const idx = list.findIndex((r) => r.id === id)
  const old = idx >= 0 ? list[idx] : undefined
  if (!old) return false
  list[idx] = { ...old, ...record, id, savedAt: old.savedAt }
  persist('total-sugar', list)
  return true
}

/** 更新淀粉记录（保留原 id 与保存时间），未找到返回 false */
export function updateStarchRecord(
  id: string,
  record: Omit<StarchRecord, 'id' | 'savedAt'>,
): boolean {
  const list = loadHistory('starch') as StarchRecord[]
  const idx = list.findIndex((r) => r.id === id)
  const old = idx >= 0 ? list[idx] : undefined
  if (!old) return false
  list[idx] = { ...old, ...record, id, savedAt: old.savedAt }
  persist('starch', list)
  return true
}

/** 更新干浸出物记录（保留原 id 与保存时间），未找到返回 false */
export function updateDryExtractRecord(
  id: string,
  record: Omit<DryExtractRecord, 'id' | 'savedAt'>,
): boolean {
  const list = loadHistory('dry-extract') as DryExtractRecord[]
  const idx = list.findIndex((r) => r.id === id)
  const old = idx >= 0 ? list[idx] : undefined
  if (!old) return false
  list[idx] = { ...old, ...record, id, savedAt: old.savedAt }
  persist('dry-extract', list)
  return true
}

export function clearHistory(type: HistoryType): void {
  persist(type, [])
}

/** 保存时间格式化为 YYYY/M/D */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 保存时间格式化为 YYYY-MM-DD（历史列表按日期分组用） */
export function formatDateKey(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 保存时间格式化为 YYYY/M/D HH:mm */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(iso)} ${hh}:${mm}`
}
