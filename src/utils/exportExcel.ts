/**
 * 历史记录导出 Excel（xlsx）
 *
 * 导出格式与实验室现有 Excel（副本过氧化氢，糖8.12.xlsx）保持一致：
 * - 绵白糖蔗糖分-5012：列布局与"绵白糖蔗糖分-5012"表相同
 * - 红糖还原糖：列布局与"红糖还原糖"表相同
 * 每条记录占两行（对应两个平行样），平均值/相对误差写在首行。
 */
import * as XLSX from 'xlsx'
import type { ReducingRecord, SucroseRecord } from './history'
import { formatDate } from './history'

/** 数值保留 4 位小数，非有限值返回空串 */
function n(v: number | null | undefined): number | string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ''
  return Math.round(v * 10000) / 10000
}

/** 导出绵白糖蔗糖分-5012 历史记录 */
export function exportSucroseHistory(records: SucroseRecord[]): void {
  const rows: (string | number)[][] = [
    [
      '日期',
      '名称',
      '编号',
      '质量m',
      '直接旋光读书-P"',
      '转化旋光读数-P"',
      '样品温度t',
      '干燥失重-Q',
      '干固物重-G',
      '含量',
      '平均值',
      '相对误差0.05',
    ],
  ]

  for (const r of records) {
    const date = formatDate(r.savedAt)
    const [a, b] = r.runs
    rows.push([
      date,
      r.sampleName,
      r.sampleNo,
      n(a.mass),
      n(a.directP),
      n(a.invertP),
      n(r.temp),
      n(r.loss),
      n(r.G),
      n(r.S1),
      n(r.avg),
      n(r.relErrorPct),
    ])
    rows.push([
      '',
      '',
      '',
      n(b.mass),
      n(b.directP),
      n(b.invertP),
      n(r.temp),
      n(r.loss),
      n(r.G),
      n(r.S2),
      '',
      '',
    ])
  }

  download(rows, '绵白糖蔗糖分-5012', '绵白糖蔗糖分-5012')
}

/** 导出红糖还原糖历史记录 */
export function exportReducingHistory(records: ReducingRecord[]): void {
  const rows: (string | number)[][] = [
    [
      '日期',
      '名称',
      '编号',
      '质量m',
      '斐林试剂校正系数',
      '滴定体积V',
      '滴定体积V2',
      '平均V',
      '蔗糖分/g/100g',
      '100ml配置试样含样品量/g',
      '消耗配制样液中蔗糖含量G/g',
      '由G查的校正系数f',
      '还原糖分含量Ag/100g',
      '平均值g/100g',
      '相对误差%',
    ],
  ]

  for (const r of records) {
    const date = formatDate(r.savedAt)
    const [a, b] = r.runs
    const [ca, cb] = r.calc
    rows.push([
      date,
      r.sampleName,
      r.sampleNo,
      n(a.mass),
      n(r.k),
      n(a.v1),
      n(a.v2),
      n(ca.V),
      n(r.sucrose),
      n(ca.m1),
      n(ca.G1),
      n(ca.f),
      n(ca.R),
      n(r.avg),
      n(r.relErrorPct),
    ])
    rows.push([
      '',
      '',
      '',
      n(b.mass),
      n(r.k),
      n(b.v1),
      n(b.v2),
      n(cb.V),
      n(r.sucrose),
      n(cb.m1),
      n(cb.G1),
      n(cb.f),
      n(cb.R),
      '',
      '',
    ])
  }

  download(rows, '红糖还原糖', '红糖还原糖')
}

/** 生成工作簿并触发下载 */
function download(rows: (string | number)[][], sheetName: string, baseName: string): void {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  // 列宽（与现有 Excel 大致一致的阅读宽度）
  ws['!cols'] = rows[0]?.map((header) => ({
    wch: Math.max(String(header).length * 2 + 2, 10),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`
  XLSX.writeFile(wb, `${baseName}_${stamp}.xlsx`)
}
