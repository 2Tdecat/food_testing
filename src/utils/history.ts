/**
 * 计算历史记录本地存储（localStorage）
 *
 * 每种计算各自独立一份历史：
 * - 'sucrose'  ：绵白糖蔗糖分-5012
 * - 'reducing' ：红糖还原糖
 */

export type HistoryType = 'sucrose' | 'reducing'

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
  v2: number | null
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

const STORAGE_KEY: Record<HistoryType, string> = {
  sucrose: 'lab_history_sucrose',
  reducing: 'lab_history_reducing',
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadHistory(type: HistoryType): SucroseRecord[] | ReducingRecord[] {
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

export function deleteRecord(type: HistoryType, id: string): void {
  const list = loadHistory(type) as { id: string }[]
  const idx = list.findIndex((r) => r.id === id)
  if (idx >= 0) {
    list.splice(idx, 1)
    persist(type, list)
  }
}

/** 按 id 查找记录 */
export function getRecord(type: HistoryType, id: string): SucroseRecord | ReducingRecord | null {
  const list = loadHistory(type) as (SucroseRecord | ReducingRecord)[]
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

export function clearHistory(type: HistoryType): void {
  persist(type, [])
}

/** 保存时间格式化为 YYYY/M/D */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 保存时间格式化为 YYYY/M/D HH:mm */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(iso)} ${hh}:${mm}`
}
