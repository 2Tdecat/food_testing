<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Toast } from 'tdesign-mobile-vue'
import SucrosePanel, { type SucroseInitial } from '@/components/sugar/SucrosePanel.vue'
import ReducingPanel, { type ReducingInitial } from '@/components/sugar/ReducingPanel.vue'
import {
  getRecord,
  updateReducingRecord,
  updateSucroseRecord,
  type HistoryType,
  type ReducingRecord,
  type SucroseRecord,
} from '@/utils/history'

const route = useRoute()
const router = useRouter()

const type = computed<HistoryType>(() =>
  route.params.type === 'reducing' ? 'reducing' : 'sucrose',
)
const id = computed(() => String(route.params.id ?? ''))

const titles: Record<HistoryType, string> = {
  sucrose: '蔗糖分记录明细',
  reducing: '还原糖记录明细',
}

/** 路由参数变化时重新加载记录 */
const reloadKey = ref(0)
watch([type, id], () => reloadKey.value++)

const sucroseRecord = computed<SucroseRecord | null>(() => {
  reloadKey.value
  if (type.value !== 'sucrose') return null
  return getRecord('sucrose', id.value) as SucroseRecord | null
})

const reducingRecord = computed<ReducingRecord | null>(() => {
  reloadKey.value
  if (type.value !== 'reducing') return null
  return getRecord('reducing', id.value) as ReducingRecord | null
})

const notFound = computed(() => {
  reloadKey.value
  return sucroseRecord.value === null && reducingRecord.value === null
})

/* ---------------- 样品信息（可编辑） ---------------- */

const sampleName = ref('')
const sampleNo = ref('')

watch(
  () => sucroseRecord.value ?? reducingRecord.value,
  (r) => {
    sampleName.value = r?.sampleName ?? ''
    sampleNo.value = r?.sampleNo ?? ''
  },
  { immediate: true },
)

/* ---------------- 面板初始数据 ---------------- */

const sucroseInitial = computed<SucroseInitial | undefined>(() =>
  sucroseRecord.value
    ? {
        loss: sucroseRecord.value.loss,
        temp: sucroseRecord.value.temp,
        runs: sucroseRecord.value.runs,
      }
    : undefined,
)

const reducingInitial = computed<ReducingInitial | undefined>(() =>
  reducingRecord.value
    ? {
        sucrose: reducingRecord.value.sucrose,
        k: reducingRecord.value.k,
        runs: reducingRecord.value.runs,
      }
    : undefined,
)

/* ---------------- 面板引用 ---------------- */

const sucroseRef = ref<InstanceType<typeof SucrosePanel>>()
const reducingRef = ref<InstanceType<typeof ReducingPanel>>()

/* ---------------- 保存修改 ---------------- */

function saveChanges() {
  if (type.value === 'sucrose') {
    if (!sucroseRef.value?.isComplete) {
      Toast.warning('数据不完整，请先填写完平行样数据')
      return
    }
    updateSucroseRecord(id.value, {
      sampleName: sampleName.value.trim(),
      sampleNo: sampleNo.value.trim(),
      ...sucroseRef.value.snapshot(),
    })
  } else {
    if (!reducingRef.value?.isComplete) {
      Toast.warning('数据不完整，请先填写完平行样数据')
      return
    }
    updateReducingRecord(id.value, {
      sampleName: sampleName.value.trim(),
      sampleNo: sampleNo.value.trim(),
      ...reducingRef.value.snapshot(),
    })
  }
  Toast.success('修改已保存')
  router.back()
}

function resetEdits() {
  sucroseRef.value?.reset()
  reducingRef.value?.reset()
  if (sucroseInitial.value) sucroseRef.value?.load(sucroseInitial.value)
  if (reducingInitial.value) reducingRef.value?.load(reducingInitial.value)
  sampleName.value = (sucroseRecord.value ?? reducingRecord.value)?.sampleName ?? ''
  sampleNo.value = (sucroseRecord.value ?? reducingRecord.value)?.sampleNo ?? ''
}
</script>

<template>
  <div class="page">
    <t-navbar :title="titles[type]" fixed placeholder @left-click="router.back()">
      <template #left>
        <t-icon name="chevron-left" size="24px" />
      </template>
    </t-navbar>

    <div class="body">
      <t-empty v-if="notFound" description="记录不存在或已被删除" class="empty">
        <template #action>
          <t-button variant="outline" size="small" @click="router.back()">返回</t-button>
        </template>
      </t-empty>

      <template v-else>
        <t-notice-bar
          class="notice"
          content="修改输入数据后点击「保存修改」，计算结果将按公式自动更新"
        />

        <!-- 样品信息 -->
        <div class="card sample-card">
          <div class="card-title">
            <span class="card-name">样品信息</span>
            <span class="card-method">保存修改时同步更新</span>
          </div>
          <t-cell-group bordered>
            <t-input v-model="sampleName" label="样品名称" placeholder="如 绵白糖 / 红糖" align="right" />
            <t-input v-model="sampleNo" label="样品编号" placeholder="如 1327-14" align="right" />
          </t-cell-group>
        </div>

        <!-- 蔗糖分明细 -->
        <SucrosePanel v-if="type === 'sucrose'" ref="sucroseRef" :initial="sucroseInitial" />

        <!-- 还原糖明细 -->
        <ReducingPanel v-else ref="reducingRef" :initial="reducingInitial" />

        <div class="actions">
          <t-button block theme="primary" @click="saveChanges">保存修改</t-button>
          <t-button block variant="outline" theme="default" class="reset-btn" @click="resetEdits">
            恢复原始数据
          </t-button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.body {
  padding: 12px;
}

.notice {
  border-radius: 8px;
  margin-bottom: 12px;
}

.empty {
  padding: 48px 0;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 0 0;
  margin-bottom: 12px;
  overflow: hidden;
}

.sample-card {
  padding-bottom: 12px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 12px;
}

.card-name {
  font-size: 16px;
  font-weight: 600;
}

.card-method {
  font-size: 12px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.actions {
  padding: 4px 4px 8px;
}

.reset-btn {
  margin-top: 12px;
}
</style>
