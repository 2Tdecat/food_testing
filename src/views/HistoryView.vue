<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Dialog, Toast } from 'tdesign-mobile-vue'
import {
  clearHistory,
  deleteRecord,
  formatDateTime,
  loadHistory,
  type HistoryType,
  type ReducingRecord,
  type SucroseRecord,
} from '@/utils/history'
import { exportReducingHistory, exportSucroseHistory } from '@/utils/exportExcel'

const route = useRoute()
const router = useRouter()

const type = computed<HistoryType>(() =>
  route.params.type === 'reducing' ? 'reducing' : 'sucrose',
)

const titles: Record<HistoryType, string> = {
  sucrose: '蔗糖分历史记录',
  reducing: '还原糖历史记录',
}

/** 刷新列表用的响应式触发器 */
const version = ref(0)

const sucroseRecords = computed<SucroseRecord[]>(() => {
  version.value
  return type.value === 'sucrose' ? (loadHistory('sucrose') as SucroseRecord[]) : []
})

const reducingRecords = computed<ReducingRecord[]>(() => {
  version.value
  return type.value === 'reducing' ? (loadHistory('reducing') as ReducingRecord[]) : []
})

const count = computed(() =>
  type.value === 'sucrose' ? sucroseRecords.value.length : reducingRecords.value.length,
)

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '--'
  return String(Number(v.toPrecision(4)))
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

function onClearAll() {
  Dialog.confirm({
    title: '清空历史记录',
    content: `确定清空全部 ${count.value} 条记录吗？此操作不可恢复。`,
    confirmBtn: '清空',
    cancelBtn: '取消',
    onConfirm: () => {
      clearHistory(type.value)
      version.value++
      Toast.success('已清空')
    },
  })
}

function onExport() {
  if (count.value === 0) {
    Toast.warning('暂无记录可导出')
    return
  }
  if (type.value === 'sucrose') {
    exportSucroseHistory(sucroseRecords.value)
  } else {
    exportReducingHistory(reducingRecords.value)
  }
}

function goDetail(id: string) {
  router.push(`/tools/history/${type.value}/${id}`)
}
</script>

<template>
  <div class="page">
    <t-navbar :title="titles[type]" fixed placeholder @left-click="router.back()">
      <template #left>
        <t-icon name="chevron-left" size="24px" />
      </template>
      <template #right>
        <t-icon name="download" size="22px" @click="onExport" />
      </template>
    </t-navbar>

    <div class="body">
      <!-- 蔗糖分记录列表 -->
      <template v-if="type === 'sucrose'">
        <div v-for="r in sucroseRecords" :key="r.id" class="record-card clickable" @click="goDetail(r.id)">
          <div class="record-head">
            <div class="record-title">
              <span v-if="r.sampleName" class="record-sample">{{ r.sampleName }}</span>
              <span v-if="r.sampleNo" class="record-no">{{ r.sampleNo }}</span>
              <span v-if="!r.sampleName && !r.sampleNo" class="record-no">未填写样品信息</span>
            </div>
            <t-icon name="delete" size="18px" class="record-delete" @click.stop="onDelete(r.id, r.sampleName || r.sampleNo)" />
          </div>
          <div class="record-date">{{ formatDateTime(r.savedAt) }}</div>
          <div class="record-grid">
            <div class="cell"><div class="k">S₁</div><div class="v">{{ fmt(r.S1) }}</div></div>
            <div class="cell"><div class="k">S₂</div><div class="v">{{ fmt(r.S2) }}</div></div>
            <div class="cell"><div class="k">平均值</div><div class="v">{{ fmt(r.avg) }}</div></div>
            <div class="cell">
              <div class="k">相对误差</div>
              <div class="v" :class="{ bad: r.relErrorPct > 0.05 }">{{ fmt(r.relErrorPct) }}%</div>
            </div>
          </div>
        </div>
      </template>

      <!-- 还原糖记录列表 -->
      <template v-else>
        <div v-for="r in reducingRecords" :key="r.id" class="record-card clickable" @click="goDetail(r.id)">
          <div class="record-head">
            <div class="record-title">
              <span v-if="r.sampleName" class="record-sample">{{ r.sampleName }}</span>
              <span v-if="r.sampleNo" class="record-no">{{ r.sampleNo }}</span>
              <span v-if="!r.sampleName && !r.sampleNo" class="record-no">未填写样品信息</span>
            </div>
            <t-icon name="delete" size="18px" class="record-delete" @click.stop="onDelete(r.id, r.sampleName || r.sampleNo)" />
          </div>
          <div class="record-date">{{ formatDateTime(r.savedAt) }}</div>
          <div class="record-grid">
            <div class="cell"><div class="k">R₁</div><div class="v">{{ fmt(r.calc[0].R) }}</div></div>
            <div class="cell"><div class="k">R₂</div><div class="v">{{ fmt(r.calc[1].R) }}</div></div>
            <div class="cell"><div class="k">平均值</div><div class="v">{{ fmt(r.avg) }}</div></div>
            <div class="cell">
              <div class="k">相对误差</div>
              <div class="v" :class="{ bad: r.relErrorPct > 15 }">{{ fmt(r.relErrorPct) }}%</div>
            </div>
          </div>
        </div>
      </template>

      <t-empty v-if="count === 0" description="暂无计算记录，请在计算页点击「保存计算结果」" class="empty" />

      <div v-if="count > 0" class="actions">
        <t-button block variant="outline" theme="danger" @click="onClearAll">清空全部记录</t-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.body {
  padding: 12px;
}

.record-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.record-card.clickable {
  cursor: pointer;
}

.record-card.clickable:active {
  background: #f5f7fa;
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
}

.record-sample {
  font-size: 15px;
  font-weight: 600;
}

.record-no {
  font-size: 13px;
  color: var(--td-text-color-secondary, rgba(0, 0, 0, 0.55));
}

.record-delete {
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
  flex-shrink: 0;
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
</style>
