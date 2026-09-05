<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import LabInput from '@/components/LabInput.vue'
import {
  calcSucrose,
  duplicateStats,
  genSucroseRun2,
  RULE_LOSS as ruleLoss,
  RULE_POLAR as rulePolar,
  RULE_SUC_MASS as ruleSucMass,
  RULE_TEMP as ruleTemp,
} from '@/utils/sugarCalc'

/** 初始数据（历史记录编辑时回填） */
export interface SucroseInitial {
  loss: number | null
  temp: number | null
  runs: [
    { mass: number | null; directP: number | null; invertP: number | null },
    { mass: number | null; directP: number | null; invertP: number | null },
  ]
}

const props = defineProps<{
  /** 卡片序号（组合页为 1，独立页为空） */
  index?: number
  initial?: SucroseInitial
}>()

/** NaN 转为 null（历史记录中未填字段） */
function nn(v: number | null | undefined): number | null {
  return v === null || v === undefined || Number.isNaN(v) ? null : v
}

/* ---------------- 输入 ---------------- */

const shared = reactive({ loss: null as number | null, temp: null as number | null })
const run1 = reactive({
  mass: null as number | null,
  directP: null as number | null,
  invertP: null as number | null,
})
const run2 = reactive({
  mass: null as number | null,
  directP: null as number | null,
  invertP: null as number | null,
})

/* ---------------- 平行样 2 自动生成 ---------------- */

/** 程序化回填期间不触发自动生成 */
const suppressGen = ref(false)

/** 依据平行样 1（及共享变量）生成平行样 2 数据 */
function genRun2() {
  const g = genSucroseRun2(
    { mass: run1.mass, directP: run1.directP, invertP: run1.invertP },
    { loss: shared.loss, temp: shared.temp },
  )
  Object.assign(run2, g ?? { mass: null, directP: null, invertP: null })
}

/* 平行样 1 / 共享变量变化时自动生成平行样 2（结果误差 < 0.05%） */
watch(
  () => [run1.mass, run1.directP, run1.invertP, shared.loss, shared.temp],
  () => {
    if (suppressGen.value) return
    genRun2()
  },
)

/* 历史记录编辑时回填初始数据 */
watch(
  () => props.initial,
  (init) => {
    if (init) applyInitial(init)
  },
  { immediate: true },
)

function applyInitial(init: NonNullable<SucroseInitial>) {
  // 回填期间屏蔽自动生成，避免覆盖历史数据
  suppressGen.value = true
  shared.loss = nn(init.loss)
  shared.temp = nn(init.temp)
  Object.assign(run1, {
    mass: nn(init.runs[0]?.mass),
    directP: nn(init.runs[0]?.directP),
    invertP: nn(init.runs[0]?.invertP),
  })
  Object.assign(run2, {
    mass: nn(init.runs[1]?.mass),
    directP: nn(init.runs[1]?.directP),
    invertP: nn(init.runs[1]?.invertP),
  })
  nextTick(() => {
    suppressGen.value = false
  })
}

/* ---------------- 计算 ---------------- */

const res1 = computed(() => calcSucrose(run1, shared))
const res2 = computed(() => calcSucrose(run2, shared))

/** 平行测定统计（精密度 ≤0.05%，标准 5.4.5） */
const stats = computed(() => {
  if (!res1.value || !res2.value) return null
  return duplicateStats(res1.value.S, res2.value.S)
})

/* ---------------- 格式化 ---------------- */

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  const s = v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' ? '0' : s
}

function fp(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  return v < 0 ? `(${fmt(v)})` : fmt(v)
}

function sig(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  return String(Number(v.toPrecision(3)))
}

/* ---------------- 公式文本 ---------------- */

const gLine = computed(() => `G = 13 × (100 − ${fp(shared.loss)}) / 100 = ${fp(res1.value?.G)} g`)

const s1Line = computed(() => {
  if (!res1.value) return 'S₁ = --'
  return `S₁ = 200 × (${fmt(run1.directP)} − ${fp(run1.invertP)}) / (132.56 − 0.0794 × (13 − ${fmt(
    res1.value.G,
  )}) − 0.53 × (${fmt(shared.temp)} − 20)) = ${fmt(res1.value.S)} g/100g`
})

const s2Line = computed(() => {
  if (!res2.value) return 'S₂ = --'
  return `S₂ = 200 × (${fmt(run2.directP)} − ${fp(run2.invertP)}) / (132.56 − 0.0794 × (13 − ${fmt(
    res2.value.G,
  )}) − 0.53 × (${fmt(shared.temp)} − 20)) = ${fmt(res2.value.S)} g/100g`
})

const avgLine = computed(() =>
  stats.value ? `S̄ = (S₁ + S₂) / 2 = ${fmt(stats.value.avg)} g/100g` : 'S̄ = --',
)

const errLine = computed(() =>
  stats.value
    ? `相对误差 = |S₁ − S₂| / S̄ × 100 = ${fmt(stats.value.relErrorPct)}%`
    : '相对误差 = --',
)

const precisionPass = computed(() => stats.value !== null && stats.value.relErrorPct <= 0.05)

/* ---------------- 对外暴露（保存记录用） ---------------- */

defineExpose({
  /** 重置所有输入 */
  reset: () => {
    shared.loss = null
    shared.temp = null
    Object.assign(run1, { mass: null, directP: null, invertP: null })
    Object.assign(run2, { mass: null, directP: null, invertP: null })
  },
  /** 用给定数据回填（NaN 视为空） */
  load: (init: NonNullable<SucroseInitial>) => applyInitial(init),
  /** 依据当前平行样 1 重新生成平行样 2 */
  regenerate: genRun2,
  /** 数据是否完整可保存 */
  isComplete: computed(
    () =>
      res1.value !== null &&
      res2.value !== null &&
      stats.value !== null &&
      run1.mass !== null &&
      run2.mass !== null,
  ),
  /** 蔗糖分平均值（还原糖分自动引用） */
  avgSucrose: computed(() => stats.value?.avg ?? null),
  /** 构建保存记录所需数据 */
  snapshot: () => ({
    loss: shared.loss ?? Number.NaN,
    temp: shared.temp ?? Number.NaN,
    runs: [{ ...run1 }, { ...run2 }] as [
      { mass: number; directP: number; invertP: number },
      { mass: number; directP: number; invertP: number },
    ],
    G: res1.value?.G ?? Number.NaN,
    S1: res1.value?.S ?? Number.NaN,
    S2: res2.value?.S ?? Number.NaN,
    avg: stats.value?.avg ?? Number.NaN,
    relErrorPct: stats.value?.relErrorPct ?? Number.NaN,
  }),
})
</script>

<template>
  <div class="card">
    <div class="card-title">
      <span v-if="index" class="card-index">{{ index }}</span>
      <span class="card-name">蔗糖分测定</span>
      <span class="card-method">二次旋光法</span>
    </div>

    <t-cell-group bordered>
      <div class="group-label">共享变量</div>
      <LabInput
        v-model="shared.loss"
        label="干燥失重 Q"
        suffix="g/100g"
        placeholder="如 1.6"
        :rule="ruleLoss"
      />
      <LabInput
        v-model="shared.temp"
        label="糖液温度 t"
        suffix="℃"
        placeholder="如 20.1"
        :rule="ruleTemp"
      />

      <div class="group-label">平行样 1</div>
      <LabInput
        v-model="run1.mass"
        label="称样质量 m₁"
        suffix="g"
        placeholder="如 65.0002"
        :rule="ruleSucMass"
      />
      <LabInput
        v-model="run1.directP"
        label="直接旋光读数 P₁"
        suffix="°Z"
        placeholder="如 46.54"
        :rule="rulePolar"
      />
      <LabInput
        v-model="run1.invertP"
        label="转化旋光读数 P₁′"
        suffix="°Z"
        placeholder="如 -15.63"
        :rule="rulePolar"
      />

      <div class="group-label">
        平行样 2
        <t-tag theme="primary" size="small" variant="light" class="auto-tag"
          >由平行样 1 自动生成</t-tag
        >
        <span class="regen" @click="genRun2">重新生成</span>
      </div>
      <LabInput
        v-model="run2.mass"
        label="称样质量 m₂"
        suffix="g"
        placeholder="填写平行样 1 后自动生成"
        :rule="ruleSucMass"
        readonly
      />
      <LabInput
        v-model="run2.directP"
        label="直接旋光读数 P₂"
        suffix="°Z"
        placeholder="自动生成"
        :rule="rulePolar"
        readonly
      />
      <LabInput
        v-model="run2.invertP"
        label="转化旋光读数 P₂′"
        suffix="°Z"
        placeholder="自动生成"
        :rule="rulePolar"
        readonly
      />
    </t-cell-group>

    <!-- 公式与结果 -->
    <div class="formula-card">
      <div class="formula-header">
        计算公式与结果
        <span class="formula-header-note">G：每100mL转化糖液内干固物质量；S：蔗糖分</span>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ gLine }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ s1Line }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ s2Line }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ avgLine }}</div>
      </div>
      <div class="formula-item result-line">
        <div class="formula-text">
          {{ errLine }}
          <t-tag v-if="stats" :theme="precisionPass ? 'success' : 'danger'" size="small">
            {{ precisionPass ? '≤0.05% 合格' : '超过0.05%精密度要求' }}
          </t-tag>
        </div>
      </div>
      <div class="final-result">
        <div class="final-label">蔗糖分（保留3位有效数字）</div>
        <div class="final-value">{{ stats ? `${sig(stats.avg)} g/100g` : '--' }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 0 0;
  margin-bottom: 12px;
  overflow: hidden;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 12px;
}

.card-index {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--lab-primary, #0052d9);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-name {
  font-size: 16px;
  font-weight: 600;
}

.card-method {
  font-size: 12px;
  color: var(--lab-primary, #0052d9);
  background: rgba(0, 82, 217, 0.06);
  border-radius: 4px;
  padding: 2px 6px;
}

.group-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-secondary, rgba(0, 0, 0, 0.55));
}

.auto-tag {
  font-weight: 400;
}

.regen {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: var(--lab-primary, #0052d9);
  text-decoration: underline;
  padding: 4px;
}

.formula-card {
  margin: 12px 16px 16px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
}

.formula-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-primary, rgba(0, 0, 0, 0.9));
  padding-bottom: 8px;
  border-bottom: 1px dashed #dcdfe6;
  margin-bottom: 8px;
}

.formula-header-note {
  font-size: 11px;
  font-weight: 400;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.formula-item {
  padding: 4px 0;
}

.formula-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--td-text-color-primary, rgba(0, 0, 0, 0.9));
  word-break: break-all;
}

.result-line {
  display: flex;
  align-items: center;
}

.final-result {
  margin-top: 8px;
  background: rgba(43, 164, 113, 0.06);
  border: 1px solid rgba(43, 164, 113, 0.25);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.final-label {
  font-size: 13px;
  color: var(--td-text-color-secondary, rgba(0, 0, 0, 0.55));
}

.final-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--lab-success, #2ba471);
}
</style>
