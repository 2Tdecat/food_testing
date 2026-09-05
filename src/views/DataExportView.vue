<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Toast } from 'tdesign-mobile-vue'
import {
  formatDateKey,
  formatDateTime,
  loadHistory,
  type DryExtractRecord,
  type HistoryType,
  type ReducingRecord,
  type StarchRecord,
  type SucroseRecord,
  type TitrationRecord,
  type TotalSugarRecord,
} from '@/utils/history'
import { exportCombinedHistory, type CombinedExportData } from '@/utils/exportExcel'

const router = useRouter()

/* ---------------- 数据类型（左侧列表，与首页工具对应） ---------------- */

const TYPE_LIST: { type: HistoryType; label: string }[] = [
  { type: 'sucrose', label: '绵白糖' },
  { type: 'reducing', label: '红糖还原糖' },
  { type: 'reducing-titration', label: '还原糖' },
  { type: 'total-sugar', label: '总糖' },
  { type: 'starch', label: '淀粉' },
  { type: 'dry-extract', label: '干浸出物' },
]

type AnyRecord =
  | SucroseRecord
  | ReducingRecord
  | TitrationRecord
  | TotalSugarRecord
  | StarchRecord
  | DryExtractRecord

/** 全部类型的历史记录（进入页面时加载一次） */
const allRecords = {} as Record<HistoryType, AnyRecord[]>
for (const t of TYPE_LIST) {
  allRecords[t.type] = loadHistory(t.type) as AnyRecord[]
}

/* ---------------- 日期范围（默认今天） ---------------- */

function toDateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function dateKeyToTs(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime()
}

const now = new Date()
const startDate = ref(toDateKey(now))
const endDate = ref(toDateKey(now))

const calendarVisible = ref(false)
const calendarValue = ref<[number, number]>([
  dateKeyToTs(startDate.value),
  dateKeyToTs(endDate.value),
])
/** 日历可选范围：2000-01-01 ~ 今天（日历默认最小值为今天，必须显式放开历史日期） */
const minDate = new Date(2000, 0, 1).getTime()
const maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

/* ---------------- 日期范围内的记录与勾选状态 ---------------- */

function selKey(type: HistoryType, id: string): string {
  return `${type}|${id}`
}

/** 各类型在日期范围内的记录 */
const inRangeRecords = computed<Record<HistoryType, AnyRecord[]>>(() => {
  const lo = startDate.value <= endDate.value ? startDate.value : endDate.value
  const hi = startDate.value <= endDate.value ? endDate.value : startDate.value
  const result = {} as Record<HistoryType, AnyRecord[]>
  for (const t of TYPE_LIST) {
    result[t.type] = allRecords[t.type].filter((r) => {
      const k = formatDateKey(r.savedAt)
      return k >= lo && k <= hi
    })
  }
  return result
})

/** 已勾选记录（key = `类型|记录id`） */
const selected = ref(new Set<string>())

/** 勾选日期范围内全部类型的数据（初始进入与切换日期范围后自动调用） */
function autoSelectRange() {
  const set = new Set<string>()
  for (const t of TYPE_LIST) {
    for (const r of inRangeRecords.value[t.type]) set.add(selKey(t.type, r.id))
  }
  selected.value = set
}

autoSelectRange()

/** 日历确认：更新范围并自动勾选范围内全部数据 */
function onRangeConfirm(value: number | Date | (number | Date)[]) {
  const arr = Array.isArray(value) ? value : [value]
  const ts = arr.map((v) => (v instanceof Date ? v.getTime() : v))
  let s = ts[0] ?? dateKeyToTs(startDate.value)
  let e = ts[1] ?? ts[0] ?? dateKeyToTs(endDate.value)
  if (s > e) [s, e] = [e, s]
  startDate.value = toDateKey(new Date(s))
  endDate.value = toDateKey(new Date(e))
  calendarValue.value = [s, e]
  autoSelectRange()
}

/* ---------------- 左侧类型列表 ---------------- */

/** 初始展示第一个有数据的类型（无数据时回退绵白糖） */
const activeType = ref<HistoryType>(
  TYPE_LIST.find((t) => inRangeRecords.value[t.type].length > 0)?.type ?? 'sucrose',
)

const typeItems = computed(() =>
  TYPE_LIST.map((t) => {
    const list = inRangeRecords.value[t.type]
    const checked = list.filter((r) => selected.value.has(selKey(t.type, r.id))).length
    return { ...t, total: list.length, checked }
  }),
)

/* ---------------- 右侧数据列表（按日期分组，支持按日期/单条勾选） ---------------- */

const groups = computed(() => {
  const map = new Map<string, AnyRecord[]>()
  for (const r of inRangeRecords.value[activeType.value]) {
    const key = formatDateKey(r.savedAt)
    const arr = map.get(key) ?? []
    arr.push(r)
    map.set(key, arr)
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }))
})

function isSelected(id: string): boolean {
  return selected.value.has(selKey(activeType.value, id))
}

function toggleSelect(id: string) {
  const key = selKey(activeType.value, id)
  if (selected.value.has(key)) selected.value.delete(key)
  else selected.value.add(key)
}

function groupIds(date: string): string[] {
  const g = groups.value.find((x) => x.date === date)
  return g ? g.items.map((r) => r.id) : []
}

function groupChecked(date: string): boolean {
  const ids = groupIds(date)
  return ids.length > 0 && ids.every((id) => selected.value.has(selKey(activeType.value, id)))
}

function groupIndeterminate(date: string): boolean {
  const ids = groupIds(date)
  const some = ids.some((id) => selected.value.has(selKey(activeType.value, id)))
  return some && !ids.every((id) => selected.value.has(selKey(activeType.value, id)))
}

/** 勾选/取消勾选某日期分组：自动勾选/取消该日期全部记录 */
function toggleGroupSelect(date: string) {
  const ids = groupIds(date)
  const all = ids.every((id) => selected.value.has(selKey(activeType.value, id)))
  for (const id of ids) {
    const key = selKey(activeType.value, id)
    if (all) selected.value.delete(key)
    else selected.value.add(key)
  }
}

/* ---------------- 全选（范围内全部类型） ---------------- */

const selectedCount = computed(() => selected.value.size)
const rangeTotal = computed(() =>
  TYPE_LIST.reduce((sum, t) => sum + inRangeRecords.value[t.type].length, 0),
)
const allSelected = computed(() => rangeTotal.value > 0 && selectedCount.value === rangeTotal.value)

function toggleSelectAll() {
  if (allSelected.value) selected.value.clear()
  else autoSelectRange()
}

/* ---------------- 记录卡片展示 ---------------- */

interface RecordGridCell {
  k: string
  v: string
  bad?: boolean
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '--'
  return String(Number(v.toPrecision(4)))
}

function gridCells(r: AnyRecord): RecordGridCell[] {
  const t = activeType.value
  if (t === 'sucrose') {
    const s = r as SucroseRecord
    return [
      { k: 'S₁', v: fmt(s.S1) },
      { k: 'S₂', v: fmt(s.S2) },
      { k: '平均值', v: fmt(s.avg) },
      { k: '相对误差', v: `${fmt(s.relErrorPct)}%`, bad: s.relErrorPct > 0.05 },
    ]
  }
  if (t === 'reducing') {
    const d = r as ReducingRecord
    return [
      { k: 'R₁', v: fmt(d.calc[0].R) },
      { k: 'R₂', v: fmt(d.calc[1].R) },
      { k: '平均值', v: fmt(d.avg) },
      { k: '相对误差', v: `${fmt(d.relErrorPct)}%`, bad: d.relErrorPct > 15 },
    ]
  }
  if (t === 'total-sugar') {
    const x = r as TotalSugarRecord
    const limit = x.mode === 'direct' ? 5 : 10
    return [
      { k: '含量₁', v: fmt(x.content[0]) },
      { k: '含量₂', v: fmt(x.content[1]) },
      { k: '平均值', v: fmt(x.avg) },
      { k: '相对误差', v: `${fmt(x.relErrorPct)}%`, bad: Math.abs(x.relErrorPct) > limit },
    ]
  }
  if (t === 'starch') {
    const x = r as StarchRecord
    const limit = x.mode === 'direct' ? 5 : 10
    return [
      { k: '含量₁', v: fmt(x.content[0]) },
      { k: '含量₂', v: fmt(x.content[1]) },
      { k: '平均值', v: fmt(x.avg) },
      { k: '相对误差', v: `${fmt(x.relErrorPct)}%`, bad: Math.abs(x.relErrorPct) > limit },
    ]
  }
  if (t === 'dry-extract') {
    const x = r as DryExtractRecord
    return [
      { k: '干浸出物₁', v: fmt(x.content[0]) },
      { k: '干浸出物₂', v: fmt(x.content[1]) },
      { k: '平均值', v: fmt(x.avg) },
      { k: '相对误差', v: `${fmt(x.relErrorPct)}%`, bad: Math.abs(x.relErrorPct) > 2 },
    ]
  }
  const x = r as TitrationRecord
  const limit = x.mode === 'direct' ? 5 : 10
  return [
    { k: '含量₁', v: fmt(x.content[0]) },
    { k: '含量₂', v: fmt(x.content[1]) },
    { k: '平均值', v: fmt(x.avg) },
    { k: '相对误差', v: `${fmt(x.relErrorPct)}%`, bad: Math.abs(x.relErrorPct) > limit },
  ]
}

/** 滴定模式/方法标签（正滴附定容体积等变体说明） */
function modeLabel(r: AnyRecord): string {
  const t = activeType.value
  if (t === 'dry-extract') {
    const x = r as DryExtractRecord
    return `密度法${x.roundResult ? '·保留2位' : ''}`
  }
  if (t === 'total-sugar') {
    const x = r as TotalSugarRecord
    const flask = x.mode === 'direct' && x.flaskVolume === 200 ? '·定200' : ''
    return `${x.mode === 'direct' ? '正滴' : '反滴'}${flask}${x.sucroseBasis ? '·蔗糖计' : ''}`
  }
  if (t === 'starch') {
    const x = r as StarchRecord
    const flask = x.flaskVolume === 200 || x.flaskVolume === 500 ? `·定${x.flaskVolume}` : ''
    return `${x.method === 1 ? '1法' : '2法'}·${x.mode === 'direct' ? '正滴' : '反滴'}${flask}`
  }
  const x = r as TitrationRecord
  if (x.mode !== 'direct') return '反滴'
  return x.flaskVolume === 100 ? '正滴·定100' : '正滴'
}

/** 是否显示模式标签（蔗糖分/红糖还原糖无模式概念） */
function hasModeLabel(): boolean {
  return (
    activeType.value === 'reducing-titration' ||
    activeType.value === 'total-sugar' ||
    activeType.value === 'starch' ||
    activeType.value === 'dry-extract'
  )
}

/* ---------------- 导出 ---------------- */

function onExport() {
  if (selectedCount.value === 0) {
    Toast.warning('请先勾选要导出的数据')
    return
  }
  const data: CombinedExportData = {}
  for (const t of TYPE_LIST) {
    const list = allRecords[t.type].filter((r) => selected.value.has(selKey(t.type, r.id)))
    if (list.length === 0) continue
    if (t.type === 'sucrose') data.sucrose = list as SucroseRecord[]
    else if (t.type === 'reducing') data.reducing = list as ReducingRecord[]
    else if (t.type === 'reducing-titration') data['reducing-titration'] = list as TitrationRecord[]
    else if (t.type === 'total-sugar') data['total-sugar'] = list as TotalSugarRecord[]
    else if (t.type === 'starch') data.starch = list as StarchRecord[]
    else data['dry-extract'] = list as DryExtractRecord[]
  }
  if (Object.keys(data).length === 0) {
    Toast.warning('请先勾选要导出的数据')
    return
  }
  exportCombinedHistory(data, { start: startDate.value, end: endDate.value })
  Toast.success('已开始导出')
}

const rangeText = computed(() =>
  startDate.value === endDate.value ? startDate.value : `${startDate.value} 至 ${endDate.value}`,
)
</script>

<template>
  <div class="page">
    <t-navbar title="数据导出" fixed placeholder @left-click="router.back()">
      <template #left>
        <t-icon name="chevron-left" size="24px" />
      </template>
    </t-navbar>

    <div class="body">
      <!-- 日期范围选择区域 -->
      <div class="date-card" @click="calendarVisible = true">
        <div class="date-field">
          <span class="date-label">开始日期</span>
          <span class="date-value">{{ startDate }}</span>
        </div>
        <span class="date-sep">至</span>
        <div class="date-field">
          <span class="date-label">结束日期</span>
          <span class="date-value">{{ endDate }}</span>
        </div>
        <t-icon name="calendar" size="20px" class="date-icon" />
      </div>

      <!-- 数据展示区域：左侧类型 + 右侧按日期展示的数据 -->
      <div class="data-area">
        <div class="type-sidebar">
          <div
            v-for="t in typeItems"
            :key="t.type"
            class="type-item"
            :class="{ 'type-item--active': t.type === activeType }"
            @click="activeType = t.type"
          >
            <div class="type-name">{{ t.label }}</div>
            <div class="type-count" :class="{ 'type-count--zero': t.total === 0 }">
              {{ t.checked }}/{{ t.total }}
            </div>
          </div>
        </div>

        <div class="data-panel">
          <div v-for="g in groups" :key="g.date" class="date-group">
            <div class="date-header">
              <t-checkbox
                :checked="groupChecked(g.date)"
                :indeterminate="groupIndeterminate(g.date)"
                class="date-check"
                @click.stop="toggleGroupSelect(g.date)"
              />
              <span class="date-text">{{ g.date }}</span>
              <span class="date-count">{{ g.items.length }} 条</span>
            </div>

            <div
              v-for="r in g.items"
              :key="r.id"
              class="record-card"
              :class="{ checked: isSelected(r.id) }"
              @click="toggleSelect(r.id)"
            >
              <div class="record-head">
                <t-checkbox
                  :checked="isSelected(r.id)"
                  class="record-check"
                  @click.stop="toggleSelect(r.id)"
                />
                <div class="record-title">
                  <span v-if="hasModeLabel()" class="record-mode">{{ modeLabel(r) }}</span>
                  <span v-if="r.sampleName" class="record-sample">{{ r.sampleName }}</span>
                  <span v-if="r.sampleNo" class="record-no">{{ r.sampleNo }}</span>
                  <span v-if="!r.sampleName && !r.sampleNo" class="record-no">未填写样品信息</span>
                </div>
                <span class="record-time">{{ formatDateTime(r.savedAt) }}</span>
              </div>
              <div class="record-grid">
                <div v-for="c in gridCells(r)" :key="c.k" class="cell">
                  <div class="k">{{ c.k }}</div>
                  <div class="v" :class="{ bad: c.bad }">{{ c.v }}</div>
                </div>
              </div>
            </div>
          </div>

          <t-empty
            v-if="groups.length === 0"
            description="该类型在选定日期范围内暂无数据"
            class="panel-empty"
          />
        </div>
      </div>
    </div>

    <!-- 底部导出操作栏 -->
    <div class="export-bar">
      <t-button variant="text" theme="default" class="select-all-btn" @click="toggleSelectAll">
        {{ allSelected ? '全不选' : '全选' }}
      </t-button>
      <div class="export-summary">
        <div class="summary-count">已选 {{ selectedCount }} 条</div>
        <div class="summary-range">{{ rangeText }}</div>
      </div>
      <t-button
        theme="primary"
        class="export-btn"
        :disabled="selectedCount === 0"
        @click="onExport"
      >
        导出 Excel
      </t-button>
    </div>

    <!-- 日期范围日历弹层 -->
    <t-calendar
      v-model:visible="calendarVisible"
      v-model="calendarValue"
      type="range"
      allow-same-day
      :min-date="minDate"
      :max-date="maxDate"
      title="选择日期范围"
      confirm-btn="确定"
      @confirm="onRangeConfirm"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--td-bg-color-page, #f3f3f3);
}

.body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
}

/* 日期范围选择卡片 */
.date-card {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
}

.date-field {
  flex: 1;
  min-width: 0;
}

.date-label {
  display: block;
  font-size: 11px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.date-value {
  display: block;
  margin-top: 2px;
  font-size: 15px;
  font-weight: 600;
}

.date-sep {
  font-size: 13px;
  color: var(--td-text-color-secondary, rgba(0, 0, 0, 0.55));
}

.date-icon {
  color: var(--lab-primary, #0052d9);
  flex-shrink: 0;
}

/* 数据展示区：左侧类型列表 + 右侧数据 */
.data-area {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 8px;
}

.type-sidebar {
  width: 86px;
  flex-shrink: 0;
  overflow-y: auto;
  background: #fff;
  border-radius: 10px;
  padding: 4px 0;
}

.type-item {
  padding: 10px 6px;
  margin: 2px 6px;
  border-radius: 8px;
  text-align: center;
}

.type-item--active {
  background: rgba(0, 82, 217, 0.08);
}

.type-item--active .type-name {
  color: var(--lab-primary, #0052d9);
  font-weight: 600;
}

.type-name {
  font-size: 13px;
  color: var(--td-text-color-primary, rgba(0, 0, 0, 0.9));
}

.type-count {
  margin-top: 2px;
  font-size: 11px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.type-count--zero {
  opacity: 0.5;
}

.data-panel {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.date-group {
  background: #fff;
  border-radius: 10px;
  padding: 0 10px;
  margin-bottom: 10px;
}

.date-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
}

.date-text {
  font-size: 14px;
  font-weight: 600;
}

.date-count {
  font-size: 12px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.record-card {
  border-top: 1px solid #f0f1f4;
  padding: 10px 0;
}

.record-card.checked .record-sample {
  color: var(--lab-primary, #0052d9);
}

.record-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.record-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
}

.record-mode {
  font-size: 11px;
  color: var(--lab-primary, #0052d9);
  background: rgba(0, 82, 217, 0.06);
  border-radius: 4px;
  padding: 1px 6px;
  flex-shrink: 0;
}

.record-sample {
  font-size: 14px;
  font-weight: 600;
}

.record-no {
  font-size: 12px;
  color: var(--td-text-color-secondary, rgba(0, 0, 0, 0.55));
}

.record-time {
  font-size: 11px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
  flex-shrink: 0;
}

.record-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 8px;
  padding-left: 28px;
}

.cell .k {
  font-size: 11px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.cell .v {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 500;
  word-break: break-all;
}

.cell .v.bad {
  color: var(--lab-danger, #d54941);
}

.panel-empty {
  padding: 48px 0;
}

/* 底部导出操作栏 */
.export-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
}

.select-all-btn {
  flex-shrink: 0;
  padding: 0 4px;
}

.export-summary {
  flex: 1;
  min-width: 0;
}

.summary-count {
  font-size: 14px;
  font-weight: 600;
}

.summary-range {
  margin-top: 1px;
  font-size: 11px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.export-btn {
  flex-shrink: 0;
  min-width: 112px;
}

.t-checkbox--block {
  padding: 0;
  background: transparent;
}
</style>
