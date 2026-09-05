<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Toast } from 'tdesign-mobile-vue'
import DryExtractPanel from '@/components/sugar/DryExtractPanel.vue'
import { addDryExtractRecord } from '@/utils/history'

const router = useRouter()

/* ---------------- 样品信息 ---------------- */

const sampleName = ref('')
const sampleNo = ref('')

/* ---------------- 面板引用 ---------------- */

const panelRef = ref<InstanceType<typeof DryExtractPanel>>()

/* ---------------- 保存计算结果 ---------------- */

function saveRecords() {
  if (!panelRef.value?.isComplete) {
    Toast.warning('数据不完整，请先填写完平行样数据')
    return
  }
  addDryExtractRecord({
    sampleName: sampleName.value.trim(),
    sampleNo: sampleNo.value.trim(),
    ...panelRef.value.snapshot(),
  })
  Toast.success('已保存计算结果')
}

function resetAll() {
  panelRef.value?.reset()
  sampleName.value = ''
  sampleNo.value = ''
}
</script>

<template>
  <div class="page">
    <t-navbar title="干浸出物" fixed placeholder @left-click="router.back()">
      <template #left>
        <t-icon name="chevron-left" size="24px" />
      </template>
      <template #right>
        <t-icon name="history" size="22px" @click="router.push('/tools/history/dry-extract')" />
      </template>
    </t-navbar>

    <div class="body">
      <t-notice-bar
        class="notice"
        content="干浸出物测定（密度法）：测原液/蒸馏液密度计算脱醇样密度，查表得总干浸出物，扣除还原糖与蔗糖得干浸出物，计算公式与实验室《15038糖11》干浸出物表一致"
        marquee
      />

      <!-- 样品信息 -->
      <div class="card sample-card">
        <div class="card-title">
          <span class="card-name">样品信息</span>
          <span class="card-method">保存记录时写入历史</span>
        </div>
        <t-cell-group bordered>
          <t-input
            v-model="sampleName"
            label="样品名称"
            placeholder="如 长城干白葡萄酒"
            align="right"
          />
          <t-input v-model="sampleNo" label="样品编号" placeholder="如 13702-1" align="right" />
        </t-cell-group>
      </div>

      <!-- 干浸出物测定 -->
      <DryExtractPanel ref="panelRef" />

      <div class="actions">
        <t-button block theme="primary" @click="saveRecords">保存计算结果</t-button>
        <t-button block variant="outline" theme="default" class="reset-btn" @click="resetAll">
          重置
        </t-button>
      </div>
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
