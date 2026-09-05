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
 * 每条记录占两行（对应两个平行样），平均值/相对误差写在首行。
 *
 * 结果列（干固物重-G、含量、平均值、相对误差等）
 * 均写入 Excel 公式并引用变量单元格：在 Excel 中修改变量后结果自动重算
 * （Excel 默认 calcMode=auto），与实验室原 Excel 的使用效果一致；
 * 同时写入缓存值，打开即可见结果。
 */
import * as XLSX from 'xlsx'
import type {
  ReducingRecord,
  StarchRecord,
  SucroseRecord,
  TitrationRecord,
  TotalSugarRecord,
} from './history'
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
    setFormula(ws, `M${row}`, `=(L${row}+L${row + 1})/2`)
    setFormula(ws, `N${row}`, `=ABS(L${row}-L${row + 1})/M${row}*100`)
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

/** 导出还原糖（正/反滴）历史记录（列布局与公式与 糖.xlsx"还原糖正滴/反滴"表一致） */
export function exportTitrationHistory(records: TitrationRecord[]): void {
  if (records.length === 0) return
  const directs = records.filter((r) => r.mode === 'direct')
  const backs = records.filter((r) => r.mode === 'back')

  const wb = XLSX.utils.book_new()
  let firstRows: (string | number | null)[][] = []

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
    XLSX.utils.book_append_sheet(wb, ws, '还原糖正滴')
    firstRows = rows
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
    XLSX.utils.book_append_sheet(wb, ws, '还原糖反滴')
    if (firstRows.length === 0) firstRows = rows
  }

  const baseName =
    directs.length > 0 && backs.length > 0
      ? '还原糖正反滴'
      : directs.length > 0
        ? '还原糖正滴'
        : '还原糖反滴'
  download(wb, baseName, firstRows)
}

/** 导出总糖（正/反滴、蔗糖计）历史记录（列布局与公式与 糖.xlsx 四个"总糖"表一致） */
export function exportTotalSugarHistory(records: TotalSugarRecord[]): void {
  if (records.length === 0) return
  // 按模式 × 蔗糖计分四组，各组对应原 Excel 一张表
  const groups: TotalSugarRecord[][] = [
    records.filter((r) => r.mode === 'direct' && !r.sucroseBasis), // 总糖正滴
    records.filter((r) => r.mode === 'back' && !r.sucroseBasis), // 总糖反滴
    records.filter((r) => r.mode === 'direct' && r.sucroseBasis), // 总糖正滴（蔗糖计）
    records.filter((r) => r.mode === 'back' && r.sucroseBasis), // 总糖反滴（蔗糖计）
  ]

  const wb = XLSX.utils.book_new()
  let firstHeader: (string | number | null)[] = []

  // 正滴表（含蔗糖计变体）：B 编号 | C 名称 | D 标定G量 | E 称样量 | F 稀释倍数
  //                    | G 滴定量 | H 糖含量 | I 平均值 | J 误差 | K 定容 | L 质量差
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
        '',
      ])
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    list.forEach((r, i) => {
      const row = 2 + i * 2
      const row2 = row + 1
      const flask = r.flaskVolume ?? 250
      // H：正滴 ROUND(G量×100×稀释×定容×100/50/称样量/滴定量/1000,2)；
      //    蔗糖计 ROUND(G量×100×稀释×100×定容/称样量/滴定量/50/1000×0.95,2)
      const h = sucrose
        ? `=ROUND(D${row}*100*F${row}*100*${flask}/E${row}/G${row}/50/1000*0.95,2)`
        : `=ROUND(D${row}*100*F${row}*${flask}*100/50/E${row}/G${row}/1000,2)`
      const h2 = sucrose
        ? `=ROUND(D${row2}*100*F${row2}*100*${flask}/E${row2}/G${row2}/50/1000*0.95,2)`
        : `=ROUND(D${row2}*100*F${row2}*${flask}*100/50/E${row2}/G${row2}/1000,2)`
      setFormula(ws, `H${row}`, h)
      setFormula(ws, `H${row2}`, h2)
      // I：平均值 ROUND(…,1)；J：误差 = (含量₁−含量₂)×100/平均值
      setFormula(ws, `I${row}`, `=ROUND((H${row}+H${row2})/2,1)`)
      setFormula(ws, `J${row}`, `=(H${row}-H${row2})*100/I${row}`)
      // L：质量差 = 含量₂−含量₁（与原表 L 列公式一致）
      setFormula(ws, `L${row}`, `=H${row2}-H${row}`)
    })
    applyColWidths(ws, header)
    XLSX.utils.book_append_sheet(wb, ws, sucrose ? '总糖正滴（蔗糖计）' : '总糖正滴')
    if (firstHeader.length === 0) firstHeader = header
  }

  // 反滴表（含蔗糖计变体）：非蔗糖计从 B 列起（B 名称 | C 编号 | D 标定G量 | E 称样量
  //   | F 滴定量 | G 糖含量 | H 平均值 | I 误差 | J 质量差），
  //   蔗糖计从 A 列起（A 名称 | B 编号 | C 标定G量 | D 称样量 | E 滴定量
  //   | F 糖含量 | G 平均值 | H 误差 | I 定容），均与原表列位一致
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
        ]
    const rows: (string | number | null)[][] = [header]
    for (const r of list) {
      const [a, b] = r.runs
      const flask = r.flaskVolume ?? 250
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
        ])
        rows.push(['', '', n(r.g), n(b.mass), n(b.volume), n(r.content[1]), '', '', ''])
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
        ])
        rows.push([null, '', '', n(r.g), n(b.mass), n(b.volume), n(r.content[1]), '', '', ''])
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    list.forEach((r, i) => {
      const row = 2 + i * 2
      const row2 = row + 1
      const flask = r.flaskVolume ?? 250
      if (sucrose) {
        // F：反滴（蔗糖计）(G量−滴定量)×定容×100×0.95×100/50/称样量/10/1000
        setFormula(ws, `F${row}`, `=(C${row}-E${row})*${flask}*100*0.95*100/50/D${row}/10/1000`)
        setFormula(ws, `F${row2}`, `=(C${row2}-E${row2})*${flask}*100*0.95*100/50/D${row2}/10/1000`)
        // G：平均值不取整；H：误差不取整（与原表一致）
        setFormula(ws, `G${row}`, `=(F${row}+F${row2})/2`)
        setFormula(ws, `H${row}`, `=(F${row}-F${row2})/G${row}*100`)
      } else {
        // G：反滴 (G量−滴定量)×定容×100×100/称样量/10/1000/50
        setFormula(ws, `G${row}`, `=(D${row}-F${row})*${flask}*100*100/E${row}/10/1000/50`)
        setFormula(ws, `G${row2}`, `=(D${row2}-F${row2})*${flask}*100*100/E${row2}/10/1000/50`)
        // H：平均值不取整；I：误差 ROUND(…,1)；J：质量差 = 含量₁−含量₂
        setFormula(ws, `H${row}`, `=(G${row}+G${row2})/2`)
        setFormula(ws, `I${row}`, `=ROUND((G${row}-G${row2})/H${row}*100,1)`)
        setFormula(ws, `J${row}`, `=G${row}-G${row2}`)
      }
    })
    applyColWidths(ws, header)
    XLSX.utils.book_append_sheet(wb, ws, sucrose ? '总糖反滴（蔗糖计）' : '总糖反滴')
    if (firstHeader.length === 0) firstHeader = header
  }

  const directs = groups[0] ?? []
  const backs = groups[1] ?? []
  const directSucrose = groups[2] ?? []
  const backSucrose = groups[3] ?? []
  const hasDirect = directs.length + directSucrose.length > 0
  const hasBack = backs.length + backSucrose.length > 0
  const hasSucrose = directSucrose.length + backSucrose.length > 0
  let baseName = '总糖'
  baseName += hasDirect && hasBack ? '正反滴' : hasDirect ? '正滴' : '反滴'
  if (hasSucrose) baseName += '（蔗糖计）'
  download(wb, baseName, [firstHeader])
}

/** 导出淀粉（1/2法、正/反滴）历史记录（列布局与公式与 糖.xlsx 四个"淀粉"表一致） */
export function exportStarchHistory(records: StarchRecord[]): void {
  if (records.length === 0) return
  // 按 模式 × 方法 分四组，各组对应原 Excel 一张表
  const groups: StarchRecord[][] = [
    records.filter((r) => r.mode === 'direct' && r.method === 1), // 淀粉一法
    records.filter((r) => r.mode === 'direct' && r.method === 2), // 淀粉二法
    records.filter((r) => r.mode === 'back' && r.method === 1), // 淀粉1法反滴
    records.filter((r) => r.mode === 'back' && r.method === 2), // 淀粉2反滴
  ]

  const wb = XLSX.utils.book_new()
  let firstHeader: (string | number | null)[] = []

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
      XLSX.utils.book_append_sheet(wb, ws, '淀粉一法')
      if (firstHeader.length === 0) firstHeader = header
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
      XLSX.utils.book_append_sheet(wb, ws, '淀粉二法')
      if (firstHeader.length === 0) firstHeader = header
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
      XLSX.utils.book_append_sheet(wb, ws, '淀粉1法反滴')
      if (firstHeader.length === 0) firstHeader = header
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
      XLSX.utils.book_append_sheet(wb, ws, '淀粉2反滴')
      if (firstHeader.length === 0) firstHeader = header
    }
  }

  const m1Direct = groups[0] ?? []
  const m2Direct = groups[1] ?? []
  const m1Back = groups[2] ?? []
  const m2Back = groups[3] ?? []
  const hasDirect = m1Direct.length + m2Direct.length > 0
  const hasBack = m1Back.length + m2Back.length > 0
  let baseName = '淀粉'
  baseName += hasDirect && hasBack ? '正反滴' : hasDirect ? '正滴' : '反滴'
  const methods = new Set<number>()
  for (const r of records) methods.add(r.method)
  if (methods.size === 1) baseName += methods.has(1) ? '1法' : '2法'
  download(wb, baseName, [firstHeader])
}

/** 生成工作簿并触发下载 */
function download(wb: XLSX.WorkBook, baseName: string, rows: (string | number | null)[][]): void {
  const firstName = wb.SheetNames[0]
  const ws = firstName ? wb.Sheets[firstName] : undefined
  if (ws) {
    // 列宽（与现有 Excel 大致一致的阅读宽度）
    applyColWidths(ws, rows[0] ?? [])
  }
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`
  XLSX.writeFile(wb, `${baseName}_${stamp}.xlsx`)
}

/** 按表头行设置列宽 */
function applyColWidths(ws: XLSX.WorkSheet, headerRow: (string | number | null)[]): void {
  ws['!cols'] = headerRow.map((header) => ({
    wch: Math.max(String(header).length * 2 + 2, 10),
  }))
}
