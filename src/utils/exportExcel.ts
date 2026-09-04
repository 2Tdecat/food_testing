/**
 * 历史记录导出 Excel（xlsx）
 *
 * 导出格式与实验室现有 Excel（副本过氧化氢，糖8.12.xlsx）保持一致：
 * - 绵白糖蔗糖分-5012：列布局与"绵白糖蔗糖分-5012"表相同
 * - 红糖还原糖：列布局与"红糖还原糖"表相同（已删除第二次滴定体积列）
 * 每条记录占两行（对应两个平行样），平均值/相对误差写在首行。
 *
 * 结果列（干固物重-G、含量、平均值、相对误差、平均V、m1、G1、f、R 等）
 * 均写入 Excel 公式并引用变量单元格：在 Excel 中修改变量后结果自动重算
 * （Excel 默认 calcMode=auto），与实验室原 Excel 的使用效果一致；
 * 同时写入缓存值，打开即可见结果。
 */
import * as XLSX from 'xlsx'
import type { ReducingRecord, SucroseRecord } from './history'
import { formatDate } from './history'
import { F_TABLE } from './sugarCalc'

/** 表2 兰-艾农恒容法校正系数表（f 查表插值用）的独立工作表名 */
const F_SHEET = '表2-f系数'

/** 数值保留 4 位小数，非有限值返回空串 */
function n(v: number | null | undefined): number | string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ''
  return Math.round(v * 10000) / 10000
}

/** 给已有数值单元格附加公式（无缓存值时不写公式） */
function setFormula(ws: XLSX.WorkSheet, addr: string, formula: string): void {
  const cell = ws[addr] as XLSX.CellObject | undefined
  if (cell && cell.t === 'n') cell.f = formula
}

/** 表2 f 系数插值公式：f = f低 + (G1 − G低)/(G高 − G低) × (f高 − f低)，越界取端点 */
function fLookupFormula(row: number): string {
  const ga = `'${F_SHEET}'!$A$2:$A$12`
  const gb = `'${F_SHEET}'!$B$2:$B$12`
  const m = `MATCH(J${row},${ga},1)`
  return (
    `=IF(J${row}<=0,1,IF(J${row}>=20,0.78,` +
    `INDEX(${gb},${m})+(J${row}-INDEX(${ga},${m}))` +
    `/(INDEX(${ga},${m}+1)-INDEX(${ga},${m}))` +
    `*(INDEX(${gb},${m}+1)-INDEX(${gb},${m}))))`
  )
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
    // 行1：平行样 1 + 平均值/相对误差；行2：平行样 2
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
      n(r.relErrorPct / 100),
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

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // 结果列写入公式：G、含量(S)、平均值、相对误差（修改变量后自动重算）
  records.forEach((r, i) => {
    const row = 2 + i * 2
    setFormula(ws, `I${row}`, `=13*(100-H${row})/100`)
    setFormula(ws, `J${row}`, `=200*(E${row}-F${row})/(132.56-0.0794*(13-I${row})-0.53*(G${row}-20))`)
    setFormula(ws, `K${row}`, `=(J${row}+J${row+1})/2`)
    setFormula(ws, `L${row}`, `=ABS(J${row}-J${row+1})/K${row}`)
    const row2 = row + 1
    setFormula(ws, `I${row2}`, `=13*(100-H${row2})/100`)
    setFormula(ws, `J${row2}`, `=200*(E${row2}-F${row2})/(132.56-0.0794*(13-I${row2})-0.53*(G${row2}-20))`)
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '绵白糖蔗糖分-5012')
  download(wb, '绵白糖蔗糖分-5012', rows)
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

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // 结果列写入公式：平均V、m1、G1、f（查表插值）、R、平均值、相对误差
  records.forEach((r, i) => {
    const row = 2 + i * 2
    setFormula(ws, `G${row}`, `=F${row}`)
    setFormula(ws, `I${row}`, `=D${row}*100/200`)
    setFormula(ws, `J${row}`, `=I${row}*H${row}*G${row}/10000`)
    setFormula(ws, `K${row}`, fLookupFormula(row))
    setFormula(ws, `L${row}`, `=1000*K${row}*E${row}/(I${row}*G${row})`)
    setFormula(ws, `M${row}`, `=(L${row}+L${row+1})/2`)
    setFormula(ws, `N${row}`, `=ABS(L${row}-L${row+1})/M${row}*100`)
    const row2 = row + 1
    setFormula(ws, `G${row2}`, `=F${row2}`)
    setFormula(ws, `I${row2}`, `=D${row2}*100/200`)
    setFormula(ws, `J${row2}`, `=I${row2}*H${row2}*G${row2}/10000`)
    setFormula(ws, `K${row2}`, fLookupFormula(row2))
    setFormula(ws, `L${row2}`, `=1000*K${row2}*E${row2}/(I${row2}*G${row2})`)
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '红糖还原糖')
  // 表2 f 系数表（K 列公式查表插值用）
  const fRows: (string | number)[][] = [['G1(g)', 'f']]
  for (const [g, f] of F_TABLE) fRows.push([g, f])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fRows), F_SHEET)
  download(wb, '红糖还原糖', rows)
}

/** 生成工作簿并触发下载 */
function download(wb: XLSX.WorkBook, baseName: string, rows: (string | number)[][]): void {
  const firstName = wb.SheetNames[0]
  const ws = firstName ? wb.Sheets[firstName] : undefined
  if (ws) {
    // 列宽（与现有 Excel 大致一致的阅读宽度）
    ws['!cols'] = rows[0]?.map((header) => ({
      wch: Math.max(String(header).length * 2 + 2, 10),
    }))
  }
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`
  XLSX.writeFile(wb, `${baseName}_${stamp}.xlsx`)
}
