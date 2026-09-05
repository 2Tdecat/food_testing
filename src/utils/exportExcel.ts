/**
 * 历史记录导出 Excel
 *
 * 导出内容与实验室现有 Excel（糖.xlsx）保持一致：
 * - 绵白糖蔗糖分-5012：列布局与"绵白糖蔗糖分-5012"表相同
 * - 红糖还原糖：列布局与"红糖还原糖"表相同（已删除第二次滴定体积列）
 * - 总糖（正/反滴、蔗糖计）：四表列布局与公式一致
 *   （总糖正滴 / 总糖正滴（蔗糖计）/ 总糖反滴 / 总糖反滴（蔗糖计））
 * - 淀粉（1/2法、正/反滴）：四表列布局与公式一致
 *   （淀粉一法 / 淀粉二法 / 淀粉1法反滴 / 淀粉2反滴）
 * - 干浸出物：列布局与 15038糖11.xlsx"干浸出物"表一致
 *   （密度/蔗糖/干浸出物结果列带公式）
 * 每条记录占两行（对应两个平行样），平均值/相对误差写在首行。
 *
 * 结果列（干固物重-G、含量、平均值、相对误差等）
 * 均写入 Excel 公式并引用变量单元格：在 Excel 中修改变量后结果自动重算
 * （Excel 默认 calcMode=auto），与实验室原 Excel 的使用效果一致；
 * 同时写入缓存值，打开即可见结果。
 *
 * exportCombinedHistory：将多类型记录汇总导出到同一个 Excel 文件，
 * 每种类型的数据放到独立的 sheet（多模式类型按现有导出规则拆分多个 sheet），
 * sheet 内格式与各类型单独导出完全一致。
 */
import * as XLSX from 'xlsx'
import type {
  DryExtractRecord,
  ReducingRecord,
  StarchRecord,
  SucroseRecord,
  TitrationRecord,
  TotalSugarRecord,
} from './history'
import { formatDate } from './history'
import { F_TABLE, calcDryExtract } from './sugarCalc'

/** 表2 兰-艾农恒容法校正系数表（f 查表插值用）的独立工作表名 */
const F_SHEET = '表2-f系数'

/** 待附加到工作簿的 sheet（名称 + 工作表） */
interface SheetSpec {
  name: string
  ws: XLSX.WorkSheet
}

/** 将 sheet 依次附加到工作簿 */
function appendSheets(wb: XLSX.WorkBook, specs: SheetSpec[]): void {
  for (const s of specs) XLSX.utils.book_append_sheet(wb, s.ws, s.name)
}

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

/** 构建绵白糖蔗糖分-5012 工作表 */
function buildSucroseSheet(records: SucroseRecord[]): SheetSpec {
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
    setFormula(
      ws,
      `J${row}`,
      `=200*(E${row}-F${row})/(132.56-0.0794*(13-I${row})-0.53*(G${row}-20))`,
    )
    setFormula(ws, `K${row}`, `=(J${row}+J${row + 1})/2`)
    setFormula(ws, `L${row}`, `=ABS(J${row}-J${row + 1})/K${row}`)
    const row2 = row + 1
    setFormula(ws, `I${row2}`, `=13*(100-H${row2})/100`)
    setFormula(
      ws,
      `J${row2}`,
      `=200*(E${row2}-F${row2})/(132.56-0.0794*(13-I${row2})-0.53*(G${row2}-20))`,
    )
  })

  applyColWidths(ws, rows[0] ?? [])
  return { name: '绵白糖蔗糖分-5012', ws }
}

/** 导出绵白糖蔗糖分-5012 历史记录 */
export function exportSucroseHistory(records: SucroseRecord[]): void {
  const wb = XLSX.utils.book_new()
  appendSheets(wb, [buildSucroseSheet(records)])
  download(wb, '绵白糖蔗糖分-5012')
}

/** 构建红糖还原糖工作表（主表 + 表2-f系数查表页） */
function buildReducingSheets(records: ReducingRecord[]): SheetSpec[] {
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
    setFormula(ws, `M${row}`, `=(L${row}+L${row + 1})/2`)
    setFormula(ws, `N${row}`, `=ABS(L${row}-L${row + 1})/M${row}*100`)
    const row2 = row + 1
    setFormula(ws, `G${row2}`, `=F${row2}`)
    setFormula(ws, `I${row2}`, `=D${row2}*100/200`)
    setFormula(ws, `J${row2}`, `=I${row2}*H${row2}*G${row2}/10000`)
    setFormula(ws, `K${row2}`, fLookupFormula(row2))
    setFormula(ws, `L${row2}`, `=1000*K${row2}*E${row2}/(I${row2}*G${row2})`)
  })

  applyColWidths(ws, rows[0] ?? [])

  // 表2 f 系数表（K 列公式查表插值用）
  const fRows: (string | number)[][] = [['G1(g)', 'f']]
  for (const [g, f] of F_TABLE) fRows.push([g, f])
  const fWs = XLSX.utils.aoa_to_sheet(fRows)
  applyColWidths(fWs, fRows[0] ?? [])
  return [
    { name: '红糖还原糖', ws },
    { name: F_SHEET, ws: fWs },
  ]
}

/** 导出红糖还原糖历史记录 */
export function exportReducingHistory(records: ReducingRecord[]): void {
  const wb = XLSX.utils.book_new()
  appendSheets(wb, buildReducingSheets(records))
  download(wb, '红糖还原糖')
}

/** 构建还原糖（正/反滴）工作表（列布局与公式与 糖.xlsx"还原糖正滴/反滴"表一致） */
function buildTitrationSheets(records: TitrationRecord[]): SheetSpec[] {
  if (records.length === 0) return []
  const directs = records.filter((r) => r.mode === 'direct')
  const backs = records.filter((r) => r.mode === 'back')
  const specs: SheetSpec[] = []

  // "还原糖正滴"表：B 编号 | C 名称 | D 标定G量 | E 称样量 | F 稀释倍数 | G 滴定量
  //                | H 糖含量 | I 平均值 | J 误差 | K 质量差 |（L 列"定250/定100"为原表备注）
  // 原表第 1 行为空行、表头在第 2 行，导出保持一致
  if (directs.length > 0) {
    const rows: (string | number | null)[][] = [
      [null],
      [
        null,
        '样品名称',
        '样品名称',
        '标定G量',
        '称样量',
        '稀释倍数',
        '滴定量',
        '糖含量g/100g',
        '平均值',
        '误差',
        '质量差',
        null,
      ],
    ]
    for (const r of directs) {
      const [a, b] = r.runs
      rows.push([
        null,
        r.sampleNo,
        r.sampleName,
        n(r.g),
        n(a.mass),
        n(r.dilution),
        n(a.volume),
        n(r.content[0]),
        n(r.avg),
        n(r.relErrorPct),
        n(r.massDiff),
        `定${r.flaskVolume ?? 250}`,
      ])
      rows.push([
        null,
        '',
        '',
        n(r.g),
        n(b.mass),
        n(r.dilution),
        n(b.volume),
        n(r.content[1]),
        '',
        '',
        '',
        '',
      ])
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    // 结果列写入公式：糖含量 H、平均值 I、误差 J、质量差 K（与原表公式一致，定容体积随记录）
    directs.forEach((r, i) => {
      const row = 3 + i * 2
      const row2 = row + 1
      const flask = r.flaskVolume ?? 250
      setFormula(ws, `H${row}`, `=ROUND(D${row}*100*F${row}*${flask}/E${row}/G${row}/1000,2)`)
      setFormula(ws, `I${row}`, `=(H${row}+H${row2})/2`)
      setFormula(ws, `J${row}`, `=(H${row}-H${row2})*100/I${row}`)
      setFormula(ws, `K${row}`, `=H${row}-H${row2}`)
      setFormula(ws, `H${row2}`, `=ROUND(D${row2}*100*F${row2}*${flask}/E${row2}/G${row2}/1000,2)`)
    })
    applyColWidths(ws, rows[1] ?? [])
    specs.push({ name: '还原糖正滴', ws })
  }

  // "还原糖反滴"表：B 编号 | C 名称 | D 标定G量 | E 称样量 | F 滴定量
  //                | G 糖含量 | H 平均值 | I 误差 | J 质量差
  if (backs.length > 0) {
    const rows: (string | number | null)[][] = [
      [
        null,
        '样品名称',
        '样品编号',
        '标定G量',
        '称样量',
        '滴定量',
        '糖含量g/100g',
        '平均值',
        '误差',
        '质量差',
      ],
    ]
    for (const r of backs) {
      const [a, b] = r.runs
      rows.push([
        null,
        r.sampleNo,
        r.sampleName,
        n(r.g),
        n(a.mass),
        n(a.volume),
        n(r.content[0]),
        n(r.avg),
        n(r.relErrorPct),
        n(r.massDiff),
      ])
      rows.push([null, '', '', n(r.g), n(b.mass), n(b.volume), n(r.content[1]), '', '', ''])
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    // 结果列写入公式：糖含量 G、平均值 H、误差 I、质量差 J（与原表公式一致）
    backs.forEach((_, i) => {
      const row = 2 + i * 2
      const row2 = row + 1
      setFormula(ws, `G${row}`, `=(D${row}-F${row})*250*100/E${row}/10/1000`)
      setFormula(ws, `H${row}`, `=(G${row}+G${row2})/2`)
      setFormula(ws, `I${row}`, `=(G${row}-G${row2})/H${row}*100`)
      setFormula(ws, `J${row}`, `=G${row}-G${row2}`)
      setFormula(ws, `G${row2}`, `=(D${row2}-F${row2})*250*100/E${row2}/10/1000`)
    })
    applyColWidths(ws, rows[0] ?? [])
    specs.push({ name: '还原糖反滴', ws })
  }
  return specs
}

/** 导出还原糖（正/反滴）历史记录 */
export function exportTitrationHistory(records: TitrationRecord[]): void {
  const specs = buildTitrationSheets(records)
  if (specs.length === 0) return
  const wb = XLSX.utils.book_new()
  appendSheets(wb, specs)
  const directCount = records.filter((r) => r.mode === 'direct').length
  const backCount = records.filter((r) => r.mode === 'back').length
  const baseName =
    directCount > 0 && backCount > 0
      ? '还原糖正反滴'
      : directCount > 0
        ? '还原糖正滴'
        : '还原糖反滴'
  download(wb, baseName)
}

/** 构建总糖（正/反滴、蔗糖计）工作表（列布局与公式与 糖.xlsx 四个"总糖"表一致） */
function buildTotalSugarSheets(records: TotalSugarRecord[]): SheetSpec[] {
  if (records.length === 0) return []
  // 按模式 × 蔗糖计分四组，各组对应原 Excel 一张表
  const groups: TotalSugarRecord[][] = [
    records.filter((r) => r.mode === 'direct' && !r.sucroseBasis), // 总糖正滴
    records.filter((r) => r.mode === 'back' && !r.sucroseBasis), // 总糖反滴
    records.filter((r) => r.mode === 'direct' && r.sucroseBasis), // 总糖正滴（蔗糖计）
    records.filter((r) => r.mode === 'back' && r.sucroseBasis), // 总糖反滴（蔗糖计）
  ]

  const specs: SheetSpec[] = []

  // 正滴表（含蔗糖计变体）：B 编号 | C 名称 | D 标定G量 | E 称样量 | F 稀释倍数
  //                    | G 滴定量 | H 糖含量 | I 平均值 | J 误差 | K 定容
  //                    | L 取用体积 | M 质量差（取用体积列置于定容列后）
  for (const idx of [0, 2]) {
    const list = groups[idx]
    if (!list || list.length === 0) continue
    const sucrose = idx === 2
    const header = [
      null,
      '样品编号',
      '样品名称',
      '标定G量',
      '称样量',
      '稀释倍数',
      '滴定量',
      '糖含量g/100g',
      '平均值',
      '误差',
      '定容',
      '取用体积',
      '质量差',
    ]
    const rows: (string | number | null)[][] = [header]
    for (const r of list) {
      const [a, b] = r.runs
      const flask = r.flaskVolume ?? 250
      const useVol = r.useVolume ?? 50
      rows.push([
        null,
        r.sampleNo,
        r.sampleName,
        n(r.g),
        n(a.mass),
        n(r.dilution),
        n(a.volume),
        n(r.content[0]),
        n(r.avg),
        n(r.relErrorPct),
        `定${flask}`,
        n(useVol),
        n(r.massDiff),
      ])
      rows.push([
        null,
        '',
        '',
        n(r.g),
        n(b.mass),
        n(r.dilution),
        n(b.volume),
        n(r.content[1]),
        '',
        '',
        '',
        n(useVol),
        '',
      ])
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    list.forEach((r, i) => {
      const row = 2 + i * 2
      const row2 = row + 1
      const flask = r.flaskVolume ?? 250
      // H：正滴 ROUND(G量×100×稀释×定容×100/取用体积/称样量/滴定量/1000,2)，
      //    取用体积引用 L 列单元格（Excel 中修改后自动重算）；
      //    蔗糖计 ROUND(G量×100×稀释×100×定容/称样量/滴定量/取用体积/1000×0.95,2)
      const h = sucrose
        ? `=ROUND(D${row}*100*F${row}*100*${flask}/E${row}/G${row}/L${row}/1000*0.95,2)`
        : `=ROUND(D${row}*100*F${row}*${flask}*100/L${row}/E${row}/G${row}/1000,2)`
      const h2 = sucrose
        ? `=ROUND(D${row2}*100*F${row2}*100*${flask}/E${row2}/G${row2}/L${row2}/1000*0.95,2)`
        : `=ROUND(D${row2}*100*F${row2}*${flask}*100/L${row2}/E${row2}/G${row2}/1000,2)`
      setFormula(ws, `H${row}`, h)
      setFormula(ws, `H${row2}`, h2)
      // I：平均值 ROUND(…,1)；J：误差 = (含量₁−含量₂)×100/平均值
      setFormula(ws, `I${row}`, `=ROUND((H${row}+H${row2})/2,1)`)
      setFormula(ws, `J${row}`, `=(H${row}-H${row2})*100/I${row}`)
      // M：质量差 = 含量₂−含量₁（与原表公式方向一致）
      setFormula(ws, `M${row}`, `=H${row2}-H${row}`)
    })
    applyColWidths(ws, header)
    specs.push({ name: sucrose ? '总糖正滴（蔗糖计）' : '总糖正滴', ws })
  }

  // 反滴表（含蔗糖计变体）：非蔗糖计从 B 列起（B 名称 | C 编号 | D 标定G量 | E 称样量
  //   | F 滴定量 | G 糖含量 | H 平均值 | I 误差 | J 质量差 | K 取用体积，
  //   原表无定容列，取用体积列置于表尾），
  //   蔗糖计从 A 列起（A 名称 | B 编号 | C 标定G量 | D 称样量 | E 滴定量
  //   | F 糖含量 | G 平均值 | H 误差 | I 定容 | J 取用体积），均与原表列位一致
  for (const idx of [1, 3]) {
    const list = groups[idx]
    if (!list || list.length === 0) continue
    const sucrose = idx === 3
    const header = sucrose
      ? [
          '样品名称',
          '样品编号',
          '标定G量',
          '称样量',
          '滴定量',
          '糖含量g/100g',
          '平均值',
          '误差',
          '定容',
          '取用体积',
        ]
      : [
          null,
          '样品名称',
          '样品编号',
          '标定G量',
          '称样量',
          '滴定量',
          '糖含量g/100g',
          '平均值',
          '误差',
          '质量差',
          '取用体积',
        ]
    const rows: (string | number | null)[][] = [header]
    for (const r of list) {
      const [a, b] = r.runs
      const flask = r.flaskVolume ?? 250
      const useVol = r.useVolume ?? 50
      if (sucrose) {
        rows.push([
          r.sampleName,
          r.sampleNo,
          n(r.g),
          n(a.mass),
          n(a.volume),
          n(r.content[0]),
          n(r.avg),
          n(r.relErrorPct),
          `定${flask}`,
          n(useVol),
        ])
        rows.push(['', '', n(r.g), n(b.mass), n(b.volume), n(r.content[1]), '', '', '', n(useVol)])
      } else {
        rows.push([
          null,
          r.sampleName,
          r.sampleNo,
          n(r.g),
          n(a.mass),
          n(a.volume),
          n(r.content[0]),
          n(r.avg),
          n(r.relErrorPct),
          n(r.massDiff),
          n(useVol),
        ])
        rows.push([
          null,
          '',
          '',
          n(r.g),
          n(b.mass),
          n(b.volume),
          n(r.content[1]),
          '',
          '',
          '',
          n(useVol),
        ])
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    list.forEach((r, i) => {
      const row = 2 + i * 2
      const row2 = row + 1
      const flask = r.flaskVolume ?? 250
      if (sucrose) {
        // F：反滴（蔗糖计）(G量−滴定量)×定容×100×0.95×100/取用体积/称样量/10/1000，
        //    取用体积引用 J 列单元格（Excel 中修改后自动重算）
        setFormula(
          ws,
          `F${row}`,
          `=(C${row}-E${row})*${flask}*100*0.95*100/J${row}/D${row}/10/1000`,
        )
        setFormula(
          ws,
          `F${row2}`,
          `=(C${row2}-E${row2})*${flask}*100*0.95*100/J${row2}/D${row2}/10/1000`,
        )
        // G：平均值不取整；H：误差不取整（与原表一致）
        setFormula(ws, `G${row}`, `=(F${row}+F${row2})/2`)
        setFormula(ws, `H${row}`, `=(F${row}-F${row2})/G${row}*100`)
      } else {
        // G：反滴 (G量−滴定量)×定容×100×100/称样量/10/1000/取用体积，
        //    取用体积引用 K 列单元格（Excel 中修改后自动重算）
        setFormula(ws, `G${row}`, `=(D${row}-F${row})*${flask}*100*100/E${row}/10/1000/K${row}`)
        setFormula(
          ws,
          `G${row2}`,
          `=(D${row2}-F${row2})*${flask}*100*100/E${row2}/10/1000/K${row2}`,
        )
        // H：平均值不取整；I：误差 ROUND(…,1)；J：质量差 = 含量₁−含量₂
        setFormula(ws, `H${row}`, `=(G${row}+G${row2})/2`)
        setFormula(ws, `I${row}`, `=ROUND((G${row}-G${row2})/H${row}*100,1)`)
        setFormula(ws, `J${row}`, `=G${row}-G${row2}`)
      }
    })
    applyColWidths(ws, header)
    specs.push({ name: sucrose ? '总糖反滴（蔗糖计）' : '总糖反滴', ws })
  }
  return specs
}

/** 导出总糖（正/反滴、蔗糖计）历史记录 */
export function exportTotalSugarHistory(records: TotalSugarRecord[]): void {
  const specs = buildTotalSugarSheets(records)
  if (specs.length === 0) return
  const wb = XLSX.utils.book_new()
  appendSheets(wb, specs)
  const hasDirect = records.some((r) => r.mode === 'direct')
  const hasBack = records.some((r) => r.mode === 'back')
  const hasSucrose = records.some((r) => r.sucroseBasis)
  let baseName = '总糖'
  baseName += hasDirect && hasBack ? '正反滴' : hasDirect ? '正滴' : '反滴'
  if (hasSucrose) baseName += '（蔗糖计）'
  download(wb, baseName)
}

/** 构建淀粉（1/2法、正/反滴）工作表（列布局与公式与 糖.xlsx 四个"淀粉"表一致） */
function buildStarchSheets(records: StarchRecord[]): SheetSpec[] {
  if (records.length === 0) return []
  // 按 模式 × 方法 分四组，各组对应原 Excel 一张表
  const groups: StarchRecord[][] = [
    records.filter((r) => r.mode === 'direct' && r.method === 1), // 淀粉一法
    records.filter((r) => r.mode === 'direct' && r.method === 2), // 淀粉二法
    records.filter((r) => r.mode === 'back' && r.method === 1), // 淀粉1法反滴
    records.filter((r) => r.mode === 'back' && r.method === 2), // 淀粉2反滴
  ]

  const specs: SheetSpec[] = []

  // 淀粉一法（正滴）：A 编号 | B 名称 | C 标定G量 | D 称样量 | E 稀释倍数
  //                 | F 滴定量 | G 糖含量 | H 平均值 | I 误差 | J 质量差（定容标记）
  {
    const list = groups[0]
    if (list && list.length > 0) {
      const header = [
        '样品编号',
        '样品名称',
        '标定G量',
        '称样量',
        '稀释倍数',
        '滴定量',
        '糖含量g/100g',
        '平均值',
        '误差',
        '质量差',
      ]
      const rows: (string | number | null)[][] = [header]
      for (const r of list) {
        const [a, b] = r.runs
        const flask = r.flaskVolume ?? 250
        rows.push([
          r.sampleNo,
          r.sampleName,
          n(r.g),
          n(a.mass),
          n(r.dilution),
          n(a.volume),
          n(r.content[0]),
          n(r.avg),
          n(r.relErrorPct),
          `定${flask}`,
        ])
        rows.push([
          '',
          '',
          n(r.g),
          n(b.mass),
          n(r.dilution),
          n(b.volume),
          n(r.content[1]),
          '',
          '',
          '',
        ])
      }
      const ws = XLSX.utils.aoa_to_sheet(rows)
      list.forEach((r, i) => {
        const row = 2 + i * 2
        const row2 = row + 1
        const flask = r.flaskVolume ?? 250
        // G：一法 ROUND(G量×100×稀释×定容×100×0.9/50/称样量/滴定量/1000,2)
        setFormula(
          ws,
          `G${row}`,
          `=ROUND(C${row}*100*E${row}*${flask}*100*0.9/50/D${row}/F${row}/1000,2)`,
        )
        setFormula(
          ws,
          `G${row2}`,
          `=ROUND(C${row2}*100*E${row2}*${flask}*100*0.9/50/D${row2}/F${row2}/1000,2)`,
        )
        // H：平均值 ROUND(…,1)；I：误差 = (含量₁−含量₂)×100/平均值
        setFormula(ws, `H${row}`, `=ROUND((G${row}+G${row2})/2,1)`)
        setFormula(ws, `I${row}`, `=(G${row}-G${row2})*100/H${row}`)
      })
      applyColWidths(ws, header)
      specs.push({ name: '淀粉一法', ws })
    }
  }

  // 淀粉二法（正滴）：B 编号 | C 名称 | D 标定G量 | E 称样量 | F 稀释倍数
  //                 | G 滴定量 | H 淀粉含量 | I 平均值 | J 误差 | K 质量差（定容标记）
  //                 原表表头 B"样品名称"/C"样品编号"与实际内容互换，照抄原表；
  //                 原表第 2 行为空行、数据自第 3 行起，导出保持一致
  {
    const list = groups[1]
    if (list && list.length > 0) {
      const header = [
        null,
        '样品名称',
        '样品编号',
        '标定G量',
        '称样量',
        '稀释倍数',
        '滴定量',
        '淀粉含量g/100g',
        '平均值',
        '误差',
        '质量差',
      ]
      const rows: (string | number | null)[][] = [header, []]
      for (const r of list) {
        const [a, b] = r.runs
        const flask = r.flaskVolume ?? 250
        rows.push([
          null,
          r.sampleNo,
          r.sampleName,
          n(r.g),
          n(a.mass),
          n(r.dilution),
          n(a.volume),
          n(r.content[0]),
          n(r.avg),
          n(r.relErrorPct),
          `定${flask}`,
        ])
        rows.push([
          null,
          '',
          '',
          n(r.g),
          n(b.mass),
          n(r.dilution),
          n(b.volume),
          n(r.content[1]),
          '',
          '',
          '',
        ])
      }
      const ws = XLSX.utils.aoa_to_sheet(rows)
      list.forEach((r, i) => {
        const row = 3 + i * 2
        const row2 = row + 1
        const flask = r.flaskVolume ?? 250
        // H：二法 G量×100×稀释×定容×0.9/称样量/滴定量/1000（不取整）
        setFormula(ws, `H${row}`, `=D${row}*100*F${row}*${flask}*0.9/E${row}/G${row}/1000`)
        setFormula(ws, `H${row2}`, `=D${row2}*100*F${row2}*${flask}*0.9/E${row2}/G${row2}/1000`)
        // I：平均值；J：误差（均不取整）
        setFormula(ws, `I${row}`, `=(H${row}+H${row2})/2`)
        setFormula(ws, `J${row}`, `=(H${row}-H${row2})/I${row}*100`)
      })
      applyColWidths(ws, header)
      specs.push({ name: '淀粉二法', ws })
    }
  }

  // 淀粉1法反滴：A 编号 | B 名称 | C 标定G量 | D 称样量 | E 滴定量
  //             | F 糖含量 | G 平均值 | H 误差（定容固定 250，与原表一致）
  //             原表表头 A"样品名称"/B"样品编号"与实际内容互换，照抄原表
  {
    const list = groups[2]
    if (list && list.length > 0) {
      const header = [
        '样品名称',
        '样品编号',
        '标定G量',
        '称样量',
        '滴定量',
        '糖含量g/100g',
        '平均值',
        '误差',
      ]
      const rows: (string | number | null)[][] = [header]
      for (const r of list) {
        const [a, b] = r.runs
        rows.push([
          r.sampleNo,
          r.sampleName,
          n(r.g),
          n(a.mass),
          n(a.volume),
          n(r.content[0]),
          n(r.avg),
          n(r.relErrorPct),
        ])
        rows.push(['', '', n(r.g), n(b.mass), n(b.volume), n(r.content[1]), '', ''])
      }
      const ws = XLSX.utils.aoa_to_sheet(rows)
      list.forEach((r, i) => {
        const row = 2 + i * 2
        const row2 = row + 1
        // F：1法反滴 (G量−滴定量)×250×100×100×0.9/称样量/10/1000/50（不取整）
        setFormula(ws, `F${row}`, `=(C${row}-E${row})*250*100*100*0.9/D${row}/10/1000/50`)
        setFormula(ws, `F${row2}`, `=(C${row2}-E${row2})*250*100*100*0.9/D${row2}/10/1000/50`)
        // G：平均值不取整；H：误差 ROUND(…,1)
        setFormula(ws, `G${row}`, `=(F${row}+F${row2})/2`)
        setFormula(ws, `H${row}`, `=ROUND((F${row}-F${row2})/G${row}*100,1)`)
      })
      applyColWidths(ws, header)
      specs.push({ name: '淀粉1法反滴', ws })
    }
  }

  // 淀粉2反滴：B 编号 | C 名称 | D 标定G量 | E 称样量 | F 稀释倍数
  //          | G 滴定量 | H 糖含量 | I 平均值 | J 误差 | K 质量差（定容标记）
  //          原表表头 B"样品名称"/C"样品编号"与实际内容互换，照抄原表
  {
    const list = groups[3]
    if (list && list.length > 0) {
      const header = [
        null,
        '样品名称',
        '样品编号',
        '标定G量',
        '称样量',
        '稀释倍数',
        '滴定量',
        '糖含量g/100g',
        '平均值',
        '误差',
        '质量差',
      ]
      const rows: (string | number | null)[][] = [header]
      for (const r of list) {
        const [a, b] = r.runs
        const flask = r.flaskVolume ?? 250
        rows.push([
          null,
          r.sampleNo,
          r.sampleName,
          n(r.g),
          n(a.mass),
          n(r.dilution),
          n(a.volume),
          n(r.content[0]),
          n(r.avg),
          n(r.relErrorPct),
          `定${flask}`,
        ])
        rows.push([
          null,
          '',
          '',
          n(r.g),
          n(b.mass),
          n(r.dilution),
          n(b.volume),
          n(r.content[1]),
          '',
          '',
          '',
        ])
      }
      const ws = XLSX.utils.aoa_to_sheet(rows)
      list.forEach((r, i) => {
        const row = 2 + i * 2
        const row2 = row + 1
        const flask = r.flaskVolume ?? 250
        // H：2反滴 (G量−滴定量)×定容×100×稀释×0.9/称样量/10/1000（不取整）
        setFormula(ws, `H${row}`, `=(D${row}-G${row})*${flask}*100*F${row}*0.9/E${row}/10/1000`)
        setFormula(
          ws,
          `H${row2}`,
          `=(D${row2}-G${row2})*${flask}*100*F${row2}*0.9/E${row2}/10/1000`,
        )
        // I：平均值；J：误差（均不取整）
        setFormula(ws, `I${row}`, `=(H${row}+H${row2})/2`)
        setFormula(ws, `J${row}`, `=(H${row}-H${row2})/I${row}*100`)
      })
      applyColWidths(ws, header)
      specs.push({ name: '淀粉2反滴', ws })
    }
  }
  return specs
}

/** 导出淀粉（1/2法、正/反滴）历史记录 */
export function exportStarchHistory(records: StarchRecord[]): void {
  const specs = buildStarchSheets(records)
  if (specs.length === 0) return
  const wb = XLSX.utils.book_new()
  appendSheets(wb, specs)
  const hasDirect = records.some((r) => r.mode === 'direct')
  const hasBack = records.some((r) => r.mode === 'back')
  let baseName = '淀粉'
  baseName += hasDirect && hasBack ? '正反滴' : hasDirect ? '正滴' : '反滴'
  const methods = new Set<number>()
  for (const r of records) methods.add(r.method)
  if (methods.size === 1) baseName += methods.has(1) ? '1法' : '2法'
  download(wb, baseName)
}

/** 构建干浸出物（密度法）工作表（列布局与公式与 15038糖11.xlsx"干浸出物"表一致） */
function buildDryExtractSheet(records: DryExtractRecord[]): SheetSpec {
  // 原表布局：A 编号 | B 名称 | C 原液密度 | D 蒸馏液密度 | E 密度g/ml
  //          | F 总干浸出物g/L | G 总糖g/L | H 还原糖g/L | I 蔗糖g/L | J 干浸出物g/L
  // 表头在第 1 行（A1/B1 空），数据自第 2 行起；总糖/还原糖两平行样共享
  const header: (string | null)[] = [
    null,
    null,
    '原液密度',
    '蒸馏液密度',
    '密度g/ml',
    '总干浸出物g/L',
    '总糖g/L',
    '还原糖g/L',
    '蔗糖g/L',
    '干浸出物g/L',
  ]
  const rows: (string | number | null)[][] = [header]
  for (const r of records) {
    const [a, b] = r.runs
    const shared = {
      totalSugar: r.totalSugar,
      reducingSugar: r.reducingSugar,
      roundResult: r.roundResult,
    }
    const ra = calcDryExtract(a, shared)
    const rb = calcDryExtract(b, shared)
    rows.push([
      r.sampleNo,
      r.sampleName,
      n(a.densityOriginal),
      n(a.densityDistilled),
      n(ra?.density ?? null),
      n(a.totalExtract),
      n(r.totalSugar),
      n(r.reducingSugar),
      n(ra?.sucrose ?? null),
      n(r.content[0]),
    ])
    rows.push([
      '',
      '',
      n(b.densityOriginal),
      n(b.densityDistilled),
      n(rb?.density ?? null),
      n(b.totalExtract),
      n(r.totalSugar),
      n(r.reducingSugar),
      n(rb?.sucrose ?? null),
      n(r.content[1]),
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  // 结果列写入公式（与原表一致，修改变量后自动重算）：
  // E：密度 ROUND(((C×1000−D×1000)+1000)/1000,4)；I：蔗糖 (G−H)×0.95（不取整）
  // J：干浸出物 F−H−I（roundResult 记录用原表 ROUND(…,2) 变体）
  records.forEach((r, i) => {
    const row = 2 + i * 2
    for (const rr of [row, row + 1]) {
      setFormula(ws, `E${rr}`, `=ROUND((((C${rr}*1000)-(D${rr}*1000))+1000)/1000,4)`)
      setFormula(ws, `I${rr}`, `=(G${rr}-H${rr})*0.95`)
      setFormula(
        ws,
        `J${rr}`,
        r.roundResult ? `=ROUND(F${rr}-H${rr}-I${rr},2)` : `=F${rr}-H${rr}-I${rr}`,
      )
    }
  })
  applyColWidths(ws, header)
  return { name: '干浸出物', ws }
}

/** 导出干浸出物（密度法）历史记录 */
export function exportDryExtractHistory(records: DryExtractRecord[]): void {
  if (records.length === 0) return
  const wb = XLSX.utils.book_new()
  appendSheets(wb, [buildDryExtractSheet(records)])
  download(wb, '干浸出物')
}

/** 多类型汇总导出的数据集（仅包含需要导出的类型） */
export interface CombinedExportData {
  /** 绵白糖蔗糖分-5012 */
  sucrose?: SucroseRecord[]
  /** 红糖还原糖 */
  reducing?: ReducingRecord[]
  /** 还原糖（正/反滴） */
  'reducing-titration'?: TitrationRecord[]
  /** 总糖（正/反滴、蔗糖计） */
  'total-sugar'?: TotalSugarRecord[]
  /** 淀粉（1/2法、正/反滴） */
  starch?: StarchRecord[]
  /** 干浸出物（密度法） */
  'dry-extract'?: DryExtractRecord[]
}

/**
 * 多类型数据汇总导出：将各类型记录合并到同一个 Excel 文件。
 * 一种类型的数据放到独立的 sheet，sheet 内列布局/公式与该类型单独导出完全一致
 * （正/反滴等多模式类型按现有导出规则拆分为多个 sheet；
 * 红糖还原糖附带"表2-f系数"查表页，供 K 列插值公式引用）。
 * 文件名：单日 `数据导出_YYYYMMDD.xlsx`，跨日 `数据导出_YYYYMMDD-YYYYMMDD.xlsx`。
 */
export function exportCombinedHistory(
  data: CombinedExportData,
  dateRange?: { start: string; end: string },
): void {
  const specs: SheetSpec[] = []
  if (data.sucrose?.length) specs.push(buildSucroseSheet(data.sucrose))
  if (data.reducing?.length) specs.push(...buildReducingSheets(data.reducing))
  if (data['reducing-titration']?.length)
    specs.push(...buildTitrationSheets(data['reducing-titration']))
  if (data['total-sugar']?.length) specs.push(...buildTotalSugarSheets(data['total-sugar']))
  if (data.starch?.length) specs.push(...buildStarchSheets(data.starch))
  if (data['dry-extract']?.length) specs.push(buildDryExtractSheet(data['dry-extract']))
  if (specs.length === 0) return

  const wb = XLSX.utils.book_new()
  appendSheets(wb, specs)

  let stamp = todayStamp()
  if (dateRange) {
    const s = dateRange.start.replaceAll('-', '')
    const e = dateRange.end.replaceAll('-', '')
    if (s && e) stamp = s === e ? s : `${s}-${e}`
  }
  XLSX.writeFile(wb, `数据导出_${stamp}.xlsx`)
}

/** 当天日期戳（YYYYMMDD，导出文件名用） */
function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** 生成工作簿并触发下载（列宽已由各 buildXxxSheet 内部设置） */
function download(wb: XLSX.WorkBook, baseName: string): void {
  XLSX.writeFile(wb, `${baseName}_${todayStamp()}.xlsx`)
}

/** 按表头行设置列宽 */
function applyColWidths(ws: XLSX.WorkSheet, headerRow: (string | number | null)[]): void {
  ws['!cols'] = headerRow.map((header) => ({
    wch: Math.max(String(header).length * 2 + 2, 10),
  }))
}
