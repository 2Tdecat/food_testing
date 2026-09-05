<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Dialog, Toast } from 'tdesign-mobile-vue'
import {
  clearHistory,
  deleteRecord,
  deleteRecords,
  formatDateKey,
  formatDateTime,
  loadHistory,
  type HistoryType,
  type DryExtractRecord,
  type ReducingRecord,
  type StarchRecord,
  type SucroseRecord,
  type TitrationRecord,
  type TotalSugarRecord,
} from '@/utils/history'
import {
  exportDryExtractHistory,
  exportReducingHistory,
  exportStarchHistory,
  exportSucroseHistory,
  exportTitrationHistory,
  exportTotalSugarHistory,
} from '@/utils/exportExcel'

interface RecordGridCell {
  k: string
  v: string
  bad?: boolean
}

const route = useRoute()
const router = useRouter()

const type = computed<HistoryType>(() => {
  const t = String(route.params.type)
  return t === 'reducing' ||
    t === 'reducing-titration' ||
    t === 'total-sugar' ||
    t === 'starch' ||
    t === 'dry-extract'
    ? t
    : 'sucrose'
})

const titles: Record<HistoryType, string> = {
  sucrose: '蔗糖分历史记录',
  reducing: '还原糖历史记录',
  'reducing-titration': '还原糖（正/反滴）历史记录',
  'total-sugar': '总糖（正/反滴、蔗糖计）历史记录',
  starch: '淀粉（1/2法、正/反滴）历史记录',
  'dry-extract': '干浸出物历史记录',
}

/** 刷新列表用的响应式触发器 */
const version = ref(0)

type AnyRecord =
  | SucroseRecord
  | ReducingRecord
  | TitrationRecord
  | TotalSugarRecord
  | StarchRecord
  | DryExtractRecord

const records = computed<AnyRecord[]>(() => {
  version.value
  return loadHistory(type.value) as AnyRecord[]
})

/* ---------------- 按日期分组（年-月-日） ---------------- */

const todayKey = computed(() => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
})

interface RecordGroup {
  date: string
  items: AnyRecord[]
}

const groups = computed<RecordGroup[]>(() => {
  const map = new Map<string, AnyRecord[]>()
  for (const r of records.value) {
    const key = formatDateKey(r.savedAt)
    const arr = map.get(key) ?? []
    arr.push(r)
    map.set(key, arr)
  }
  // 记录本身按新→旧存储，分组按日期新→旧展示
  return [...map.entries()].map(([date, items]) => ({ date, items }))
})

/** 展开状态：未显式操作过的日期默认仅今天展开 */
const openMap = ref<Record<string, boolean>>({})

function isExpanded(date: string): boolean {
  return openMap.value[date] ?? date === todayKey.value
}

function toggleDateExpand(date: string) {
  openMap.value[date] = !isExpanded(date)
}

/* ---------------- 批量管理模式 ---------------- */

const manageMode = ref(false)
/** 已勾选的记录 id */
const selected = ref(new Set<string>())

function enterManage() {
  manageMode.value = true
  selected.value.clear()
}

function exitManage() {
  manageMode.value = false
  selected.value.clear()
}

// 切换功能类型（蔗糖分/还原糖）时重置管理状态
watch(type, () => {
  manageMode.value = false
  selected.value.clear()
  openMap.value = {}
})

function isSelected(id: string): boolean {
  return selected.value.has(id)
}

function toggleSelect(id: string) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
}

function groupIds(date: string): string[] {
  const g = groups.value.find((x) => x.date === date)
  return g ? g.items.map((r) => r.id) : []
}

function groupChecked(date: string): boolean {
  const ids = groupIds(date)
  return ids.length > 0 && ids.every((id) => selected.value.has(id))
}

function groupIndeterminate(date: string): boolean {
  const ids = groupIds(date)
  const some = ids.some((id) => selected.value.has(id))
  return some && !ids.every((id) => selected.value.has(id))
}

/** 勾选/取消勾选日期分类：自动勾选/取消分类下全部记录 */
function toggleGroupSelect(date: string) {
  const ids = groupIds(date)
  if (ids.every((id) => selected.value.has(id))) ids.forEach((id) => selected.value.delete(id))
  else ids.forEach((id) => selected.value.add(id))
}

const selectedCount = computed(() => selected.value.size)
const totalCount = computed(() => records.value.length)
const allSelected = computed(() => totalCount.value > 0 && selectedCount.value === totalCount.value)

/** 全选 / 全不选 */
function toggleSelectAll() {
  if (allSelected.value) selected.value.clear()
  else records.value.forEach((r) => selected.value.add(r.id))
}

/* ---------------- 记录卡片展示 ---------------- */

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '--'
  return String(Number(v.toPrecision(4)))
}

function gridCells(r: AnyRecord): RecordGridCell[] {
  if (type.value === 'sucrose') {
    const s = r as SucroseRecord
    return [
      { k: 'S₁', v: fmt(s.S1) },
      { k: 'S₂', v: fmt(s.S2) },
      { k: '平均值', v: fmt(s.avg) },
      { k: '相对误差', v: `${fmt(s.relErrorPct)}%`, bad: s.relErrorPct > 0.05 },
    ]
  }
  if (type.value === 'reducing') {
    const d = r as ReducingRecord
    return [
      { k: 'R₁', v: fmt(d.calc[0].R) },
      { k: 'R₂', v: fmt(d.calc[1].R) },
      { k: '平均值', v: fmt(d.avg) },
      { k: '相对误差', v: `${fmt(d.relErrorPct)}%`, bad: d.relErrorPct > 15 },
    ]
  }
  if (type.value === 'total-sugar') {
    const t = r as TotalSugarRecord
    const limit = t.mode === 'direct' ? 5 : 10
    return [
      { k: '含量₁', v: fmt(t.content[0]) },
      { k: '含量₂', v: fmt(t.content[1]) },
      { k: '平均值', v: fmt(t.avg) },
      { k: '相对误差', v: `${fmt(t.relErrorPct)}%`, bad: Math.abs(t.relErrorPct) > limit },
    ]
  }
  if (type.value === 'starch') {
    const t = r as StarchRecord
    const limit = t.mode === 'direct' ? 5 : 10
    return [
      { k: '含量₁', v: fmt(t.content[0]) },
      { k: '含量₂', v: fmt(t.content[1]) },
      { k: '平均值', v: fmt(t.avg) },
      { k: '相对误差', v: `${fmt(t.relErrorPct)}%`, bad: Math.abs(t.relErrorPct) > limit },
    ]
  }
  if (type.value === 'dry-extract') {
    const t = r as DryExtractRecord
    return [
      { k: '干浸出物₁', v: fmt(t.content[0]) },
      { k: '干浸出物₂', v: fmt(t.content[1]) },
      { k: '平均值', v: fmt(t.avg) },
      { k: '相对误差', v: `${fmt(t.relErrorPct)}%`, bad: Math.abs(t.relErrorPct) > 2 },
    ]
  }
  const t = r as TitrationRecord
  const limit = t.mode === 'direct' ? 5 : 10
  return [
    { k: '含量₁', v: fmt(t.content[0]) },
    { k: '含量₂', v: fmt(t.content[1]) },
    { k: '平均值', v: fmt(t.avg) },
    { k: '相对误差', v: `${fmt(t.relErrorPct)}%`, bad: Math.abs(t.relErrorPct) > limit },
  ]
}

/** 滴定模式标签（还原糖/总糖/淀粉正反滴记录卡片显示，正滴附定容体积） */
function titrationModeLabel(r: AnyRecord): string {
  if (type.value === 'dry-extract') {
    const t = r as DryExtractRecord
    return `密度法${t.roundResult ? '·保留2位' : ''}`
  }
  if (type.value === 'total-sugar') {
    const t = r as TotalSugarRecord
    const flask = t.mode === 'direct' && t.flaskVolume === 200 ? '·定200' : ''
    const useVol = t.useVolume != null && t.useVolume !== 50 ? `·取${t.useVolume}` : ''
    return `${t.mode === 'direct' ? '正滴' : '反滴'}${flask}${useVol}${t.sucroseBasis ? '·蔗糖计' : ''}`
  }
  if (type.value === 'starch') {
    const t = r as StarchRecord
    const flask = t.flaskVolume === 200 || t.flaskVolume === 500 ? `·定${t.flaskVolume}` : ''
    return `${t.method === 1 ? '1法' : '2法'}·${t.mode === 'direct' ? '正滴' : '反滴'}${flask}`
  }
  const t = r as TitrationRecord
  if (t.mode !== 'direct') return '反滴'
  return t.flaskVolume === 100 ? '正滴·定100' : '正滴'
}

/* ---------------- 操作 ---------------- */

function goDetail(id: string) {
  router.push(`/tools/history/${type.value}/${id}`)
}

function onDelete(id: string, sample: string) {
  Dialog.confirm({
    title: '删除记录',
    content: `确定删除${sample ? `「${sample}」的` : '这条'}计算记录吗？`,
    confirmBtn: '删除',
    cancelBtn: '取消',
    onConfirm: () => {
      deleteRecord(type.value, id)
      version.value++
      Toast.success('已删除')
    },
  })
}

/** 批量删除（带确认弹窗） */
function onBatchDelete() {
  if (selectedCount.value === 0) {
    Toast.warning('请先勾选要删除的记录')
    return
  }
  Dialog.confirm({
    title: '批量删除',
    content: `确定删除选中的 ${selectedCount.value} 条记录吗？此操作不可恢复。`,
    confirmBtn: '删除',
    cancelBtn: '取消',
    onConfirm: () => {
      deleteRecords(type.value, [...selected.value])
      selected.value.clear()
      version.value++
      Toast.success('已删除')
    },
  })
}

/** 导出选中的记录 */
function onBatchExport() {
  if (selectedCount.value === 0) {
    Toast.warning('请先勾选要导出的记录')
    return
  }
  const sel = records.value.filter((r) => selected.value.has(r.id))
  if (type.value === 'sucrose') {
    exportSucroseHistory(sel as SucroseRecord[])
  } else if (type.value === 'reducing') {
    exportReducingHistory(sel as ReducingRecord[])
  } else if (type.value === 'total-sugar') {
    exportTotalSugarHistory(sel as TotalSugarRecord[])
  } else if (type.value === 'starch') {
    exportStarchHistory(sel as StarchRecord[])
  } else if (type.value === 'dry-extract') {
    exportDryExtractHistory(sel as DryExtractRecord[])
  } else {
    exportTitrationHistory(sel as TitrationRecord[])
  }
}

/** 导出全部记录 */
function onExport() {
  if (totalCount.value === 0) {
    Toast.warning('暂无记录可导出')
    return
  }
  if (type.value === 'sucrose') {
    exportSucroseHistory(records.value as SucroseRecord[])
  } else if (type.value === 'reducing') {
    exportReducingHistory(records.value as ReducingRecord[])
  } else if (type.value === 'total-sugar') {
    exportTotalSugarHistory(records.value as TotalSugarRecord[])
  } else if (type.value === 'starch') {
    exportStarchHistory(records.value as StarchRecord[])
  } else if (type.value === 'dry-extract') {
    exportDryExtractHistory(records.value as DryExtractRecord[])
  } else {
    exportTitrationHistory(records.value as TitrationRecord[])
  }
}

function onClearAll() {
  Dialog.confirm({
    title: '清空历史记录',
    content: `确定清空全部 ${totalCount.value} 条记录吗？此操作不可恢复。`,
    confirmBtn: '清空',
    cancelBtn: '取消',
    onConfirm: () => {
      clearHistory(type.value)
      version.value++
      Toast.success('已清空')
    },
  })
}

const navTitle = computed(() =>
  manageMode.value ? `${titles[type.value]}（已选 ${selectedCount.value}）` : titles[type.value],
)
</script>

<template>
  <div class="page">
    <t-navbar :title="navTitle" fixed placeholder @left-click="router.back()">
      <template #left>
        <t-icon name="chevron-left" size="24px" />
      </template>
      <template #right>
        <template v-if="!manageMode">
          <t-icon name="download" size="22px" class="nav-icon" @click="onExport" />
          <span class="nav-manage" @click="enterManage">管理</span>
        </template>
        <span v-else class="nav-manage" @click="exitManage">完成</span>
      </template>
    </t-navbar>

    <div class="body" :class="{ 'body--manage': manageMode }">
      <!-- 按日期分组 -->
      <div v-for="g in groups" :key="g.date" class="date-group">
        <div class="date-header" @click="toggleDateExpand(g.date)">
          <t-checkbox
            v-if="manageMode"
            :checked="groupChecked(g.date)"
            :indeterminate="groupIndeterminate(g.date)"
            class="date-check"
            @click.stop="toggleGroupSelect(g.date)"
          />
          <span class="date-text">{{ g.date }}</span>
          <span class="date-count">{{ g.items.length }} 条</span>
          <t-icon
            :name="isExpanded(g.date) ? 'chevron-up' : 'chevron-down'"
            size="18px"
            class="date-arrow"
          />
        </div>

        <div v-show="isExpanded(g.date)">
          <div
            v-for="r in g.items"
            :key="r.id"
            class="record-card"
            :class="{ clickable: !manageMode, checked: manageMode && isSelected(r.id) }"
            @click="manageMode ? toggleSelect(r.id) : goDetail(r.id)"
          >
            <div class="record-head">
              <t-checkbox
                v-if="manageMode"
                :checked="isSelected(r.id)"
                class="record-check"
                @click.stop="toggleSelect(r.id)"
              />
              <div class="record-title">
                <span
                  v-if="
                    type === 'reducing-titration' ||
                    type === 'total-sugar' ||
                    type === 'starch' ||
                    type === 'dry-extract'
                  "
                  class="record-mode"
                  >{{ titrationModeLabel(r) }}</span
                >
                <span v-if="r.sampleName" class="record-sample">{{ r.sampleName }}</span>
                <span v-if="r.sampleNo" class="record-no">{{ r.sampleNo }}</span>
                <span v-if="!r.sampleName && !r.sampleNo" class="record-no">未填写样品信息</span>
              </div>
              <!-- 删除：加大点击热区，阻止冒泡避免跳转详情 -->
              <div
                v-if="!manageMode"
                class="delete-zone"
                @click.stop="onDelete(r.id, r.sampleName || r.sampleNo)"
              >
                <t-icon name="delete" size="18px" class="record-delete" />
              </div>
            </div>
            <div class="record-date">{{ formatDateTime(r.savedAt) }}</div>
            <div class="record-grid">
              <div v-for="c in gridCells(r)" :key="c.k" class="cell">
                <div class="k">{{ c.k }}</div>
                <div class="v" :class="{ bad: c.bad }">{{ c.v }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <t-empty
        v-if="totalCount === 0"
        description="暂无计算记录，请在计算页点击「保存计算结果」"
        class="empty"
      />

      <div v-if="!manageMode && totalCount > 0" class="actions">
        <t-button block variant="outline" theme="danger" @click="onClearAll">清空全部记录</t-button>
      </div>
    </div>

    <!-- 批量管理底部操作栏 -->
    <div v-if="manageMode" class="batch-bar">
      <t-button variant="text" theme="default" class="batch-btn" @click="toggleSelectAll">
        {{ allSelected ? '全不选' : '全选' }}
      </t-button>
      <t-button
        variant="outline"
        theme="danger"
        class="batch-btn"
        :disabled="selectedCount === 0"
        @click="onBatchDelete"
      >
        删除{{ selectedCount > 0 ? `(${selectedCount})` : '' }}
      </t-button>
      <t-button
        theme="primary"
        class="batch-btn"
        :disabled="selectedCount === 0"
        @click="onBatchExport"
      >
        导出{{ selectedCount > 0 ? `(${selectedCount})` : '' }}
      </t-button>
    </div>
  </div>
</template>

<style scoped>
.body {
  padding: 12px;
}

.body--manage {
  padding-bottom: 80px;
}

.nav-icon {
  margin-right: 16px;
}

.nav-manage {
  font-size: 14px;
  color: var(--lab-primary, #0052d9);
  padding: 4px;
}

.date-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
}

.date-text {
  font-size: 14px;
  font-weight: 600;
}

.date-count {
  font-size: 12px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.date-arrow {
  margin-left: auto;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.record-card {
  background: #fff;
  border-radius: 12px;
  padding: 12px 8px;
  margin-bottom: 12px;
  border: 1px solid transparent;
}

.record-card.clickable {
  cursor: pointer;
}

.record-card.clickable:active {
  background: #f5f7fa;
}

.record-card.checked {
  border-color: var(--lab-primary, #0052d9);
}

.record-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.record-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.record-sample {
  font-size: 15px;
  font-weight: 600;
}

.record-no {
  font-size: 13px;
  color: var(--td-text-color-secondary, rgba(0, 0, 0, 0.55));
}

/* 滴定模式标签（正滴/反滴） */
.record-mode {
  font-size: 11px;
  color: var(--lab-primary, #0052d9);
  background: rgba(0, 82, 217, 0.06);
  border-radius: 4px;
  padding: 1px 6px;
  flex-shrink: 0;
}

/* 删除热区：扩大点击范围，避免误触卡片跳详情 */
.delete-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  margin: -10px;
  margin-left: 0;
  flex-shrink: 0;
}

.record-delete {
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.record-date {
  margin-top: 2px;
  font-size: 12px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.record-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.cell .k {
  font-size: 11px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.cell .v {
  margin-top: 2px;
  font-size: 14px;
  font-weight: 500;
  word-break: break-all;
}

.cell .v.bad {
  color: var(--lab-danger, #d54941);
}

.empty {
  padding: 48px 0;
}

.actions {
  padding: 8px 4px 24px;
}

/* 批量管理底部操作栏 */
.batch-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 8px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.batch-btn {
  flex: 1;
}

.t-checkbox--block {
  padding: 0;
  background: transparent;
}

.date-group {
  background: white;
  border-radius: 8px;
  padding: 0 8px;
  margin-bottom: 12px;
}
</style>
