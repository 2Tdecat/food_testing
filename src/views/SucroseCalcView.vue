<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Toast } from 'tdesign-mobile-vue'
import SucrosePanel from '@/components/sugar/SucrosePanel.vue'
import { addSucroseRecord } from '@/utils/history'

const router = useRouter()

/* ---------------- 样品信息 ---------------- */

const sampleName = ref('')
const sampleNo = ref('')

/* ---------------- 面板引用 ---------------- */

const sucroseRef = ref<InstanceType<typeof SucrosePanel>>()

/* ---------------- 保存计算结果 ---------------- */

function saveRecords() {
  if (!sucroseRef.value?.isComplete) {
    Toast.warning('数据不完整，请先填写完平行样数据')
    return
  }
  addSucroseRecord({
    sampleName: sampleName.value.trim(),
    sampleNo: sampleNo.value.trim(),
    ...sucroseRef.value.snapshot(),
  })
  Toast.success('已保存计算结果')
}

function resetAll() {
  sucroseRef.value?.reset()
  sampleName.value = ''
  sampleNo.value = ''
}
</script>

<template>
  <div class="page">
    <t-navbar title="绵白糖红糖蔗糖分" fixed placeholder @left-click="router.back()">
      <template #left>
        <t-icon name="chevron-left" size="24px" />
      </template>
      <template #right>
        <t-icon name="history" size="22px" @click="router.push('/tools/history/sucrose')" />
      </template>
    </t-navbar>

    <div class="body">
      <t-notice-bar
        class="notice"
        content="依据 QB/T 8040-2024《赤砂糖试验方法》第5章：蔗糖分用二次旋光法测定，平行测定结果取算术平均值"
        marquee
      />

      <!-- 样品信息 -->
      <div class="card sample-card">
        <div class="card-title">
          <span class="card-name">样品信息</span>
          <span class="card-method">保存记录时写入历史</span>
        </div>
        <t-cell-group bordered>
          <t-input v-model="sampleName" label="样品名称" placeholder="如 绵白糖" align="right" />
          <t-input v-model="sampleNo" label="样品编号" placeholder="如 1327-14" align="right" />
        </t-cell-group>
      </div>

      <!-- 蔗糖分测定 -->
      <SucrosePanel ref="sucroseRef" />

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
