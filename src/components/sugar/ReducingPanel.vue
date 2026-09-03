<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import LabInput from '@/components/LabInput.vue'
import type { ValidationRule } from '@/utils/sugarCalc'
import { calcReducing } from '@/utils/sugarCalc'

/** 初始数据（历史记录编辑时回填） */
export interface ReducingInitial {
  sucrose: number | null
  k: number | null
  runs: [
    { mass: number | null; v1: number | null; v2: number | null },
    { mass: number | null; v1: number | null; v2: number | null },
  ]
}

const props = defineProps<{
  /** 卡片序号（组合页为 2，独立页为空） */
  index?: number
  /** 蔗糖分自动值（组合页传入；独立页不传则手动输入） */
  autoSucrose?: number | null
  initial?: ReducingInitial
}>()

/** NaN 转为 null（历史记录中未填字段） */
function nn(v: number | null | undefined): number | null {
  return v === null || v === undefined || Number.isNaN(v) ? null : v
}

/* ---------------- 变量校验规则（依据 QB/T 8040-2024） ---------------- */

/** 还原糖称样量约 26g，可视含量增减（标准 6.4.1） */
const ruleRedMass: ValidationRule = {
  min: 0.1,
  max: 60,
  warnMin: 10,
  warnMax: 45,
  message: '称样量应在 0~60g 之间',
  warnMessage: '标准规定称样量约 26g，可视还原糖含量高低增减',
}
/** 滴定管 50mL（标准 6.2.2） */
const ruleVolume: ValidationRule = { min: 0, max: 50, message: '滴定管量程 50mL' }
/** 费林溶液浓度校正系数 K（标准 6.3.4.2，K = 标定耗用体积/40） */
const ruleK: ValidationRule = {
  min: 0.5,
  max: 2,
  warnMin: 0.95,
  warnMax: 1.2,
  message: '校正系数应在 0.5~2 之间',
  warnMessage: 'K = 标定耗用标准转化糖液体积/40，通常接近 1',
}
/** 蔗糖分 */
const ruleSucrose: ValidationRule = { min: 0, max: 100, message: '蔗糖分应在 0~100 g/100g 之间' }

/* ---------------- 输入 ---------------- */

/** 蔗糖分 S：组合页自动取蔗糖分测定平均值，可手动改写 */
const sucrose = ref<number | null>(null)
const sucroseManual = ref(false)
const hasAuto = computed(() => props.autoSucrose !== undefined)

watch(
  () => props.autoSucrose ?? null,
  (v) => {
    if (!sucroseManual.value) sucrose.value = v
  },
  { immediate: true },
)

function resumeAutoSucrose() {
  sucroseManual.value = false
  sucrose.value = props.autoSucrose ?? null
}

function onSucroseInput(v: number | null) {
  sucroseManual.value = true
  sucrose.value = v
}

/** 费林溶液浓度校正系数（默认 42.1/40≈1.0525） */
const k = ref<number | null>(1.0525)

const run1 = reactive({
  mass: null as number | null,
  v1: null as number | null,
  v2: null as number | null,
})
const run2 = reactive({
  mass: null as number | null,
  v1: null as number | null,
  v2: null as number | null,
})

/* 历史记录编辑时回填初始数据 */
watch(
  () => props.initial,
  (init) => {
    if (init) applyInitial(init)
  },
  { immediate: true },
)

function applyInitial(init: NonNullable<ReducingInitial>) {
  // 回填蔗糖分视为手动输入（避免被 autoSucrose 观察覆盖）
  if (nn(init.sucrose) !== null) sucroseManual.value = true
  sucrose.value = nn(init.sucrose)
  k.value = nn(init.k) ?? 1.0525
  Object.assign(run1, {
    mass: nn(init.runs[0]?.mass),
    v1: nn(init.runs[0]?.v1),
    v2: nn(init.runs[0]?.v2),
  })
  Object.assign(run2, {
    mass: nn(init.runs[1]?.mass),
    v1: nn(init.runs[1]?.v1),
    v2: nn(init.runs[1]?.v2),
  })
}

/* ---------------- 计算 ---------------- */

const shared = computed(() => ({ sucrose: sucrose.value, k: k.value }))
const res1 = computed(() => calcReducing(run1, shared.value))
const res2 = computed(() => calcReducing(run2, shared.value))

/** 平行测定统计（精密度 ≤15%，标准 6.6） */
const stats = computed(() => {
  if (!res1.value || !res2.value) return null
  const avg = (res1.value.R + res2.value.R) / 2
  if (avg === 0) return null
  return { avg, relErrorPct: (Math.abs(res1.value.R - res2.value.R) / avg) * 100 }
})

/* ---------------- 格式化 ---------------- */

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  const s = v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' ? '0' : s
}

function sig(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  return String(Number(v.toPrecision(3)))
}

/* ---------------- 公式文本 ---------------- */

const v1Line = computed(() =>
  res1.value ? `V₁ = (${fmt(run1.v1)} + ${fmt(run1.v2)}) / 2 = ${fmt(res1.value.V)} mL` : 'V₁ = --',
)

const v2Line = computed(() =>
  res2.value ? `V₂ = (${fmt(run2.v1)} + ${fmt(run2.v2)}) / 2 = ${fmt(res2.value.V)} mL` : 'V₂ = --',
)

const m1Line = computed(() =>
  res1.value ? `m₁ = ${fmt(run1.mass)} × 100 / 200 = ${fmt(res1.value.m1)} g` : 'm₁ = --',
)

const m2Line = computed(() =>
  res2.value ? `m₂ = ${fmt(run2.mass)} × 100 / 200 = ${fmt(res2.value.m1)} g` : 'm₂ = --',
)

const g1Line = computed(() =>
  res1.value
    ? `G₁ = m₁ × S × V₁ / 10000 = ${fmt(res1.value.m1)} × ${fmt(sucrose.value)} × ${fmt(res1.value.V)} / 10000 = ${fmt(res1.value.G1)} g`
    : 'G₁ = --',
)

const g2Line = computed(() =>
  res2.value
    ? `G₂ = m₂ × S × V₂ / 10000 = ${fmt(res2.value.m1)} × ${fmt(sucrose.value)} × ${fmt(res2.value.V)} / 10000 = ${fmt(res2.value.G1)} g`
    : 'G₂ = --',
)

const f1Line = computed(() =>
  res1.value ? `f₁ = ${fmt(res1.value.f)}（由 G₁ 查表2线性插值）` : 'f₁ = --',
)

const f2Line = computed(() =>
  res2.value ? `f₂ = ${fmt(res2.value.f)}（由 G₂ 查表2线性插值）` : 'f₂ = --',
)

const r1Line = computed(() =>
  res1.value ? `R₁ = 1000 × f₁ × K / (m₁ × V₁) = ${fmt(res1.value.R)} g/100g` : 'R₁ = --',
)

const r2Line = computed(() =>
  res2.value ? `R₂ = 1000 × f₂ × K / (m₂ × V₂) = ${fmt(res2.value.R)} g/100g` : 'R₂ = --',
)

const avgLine = computed(() =>
  stats.value ? `R̄ = (R₁ + R₂) / 2 = ${fmt(stats.value.avg)} g/100g` : 'R̄ = --',
)

const errLine = computed(() =>
  stats.value ? `相对误差 = |R₁ − R₂| / R̄ × 100 = ${fmt(stats.value.relErrorPct)}%` : '相对误差 = --',
)

const precisionPass = computed(() => stats.value !== null && stats.value.relErrorPct <= 15)

/* ---------------- 对外暴露（保存记录用） ---------------- */

defineExpose({
  /** 重置所有输入 */
  reset: () => {
    sucroseManual.value = false
    sucrose.value = props.autoSucrose ?? null
    k.value = 1.0525
    Object.assign(run1, { mass: null, v1: null, v2: null })
    Object.assign(run2, { mass: null, v1: null, v2: null })
  },
  /** 用给定数据回填（NaN 视为空） */
  load: (init: NonNullable<ReducingInitial>) => applyInitial(init),
  /** 数据是否完整可保存 */
  isComplete: computed(
    () =>
      res1.value !== null &&
      res2.value !== null &&
      stats.value !== null &&
      sucrose.value !== null &&
      run1.mass !== null &&
      run2.mass !== null,
  ),
  /** 构建保存记录所需数据 */
  snapshot: () => ({
    sucrose: sucrose.value ?? Number.NaN,
    k: k.value ?? Number.NaN,
    runs: [
      { ...run1 },
      { ...run2 },
    ] as [{ mass: number; v1: number; v2: number }, { mass: number; v1: number; v2: number }],
    calc: [
      {
        V: res1.value?.V ?? Number.NaN,
        m1: res1.value?.m1 ?? Number.NaN,
        G1: res1.value?.G1 ?? Number.NaN,
        f: res1.value?.f ?? Number.NaN,
        R: res1.value?.R ?? Number.NaN,
      },
      {
        V: res2.value?.V ?? Number.NaN,
        m1: res2.value?.m1 ?? Number.NaN,
        G1: res2.value?.G1 ?? Number.NaN,
        f: res2.value?.f ?? Number.NaN,
        R: res2.value?.R ?? Number.NaN,
      },
    ] as [{ V: number; m1: number; G1: number; f: number; R: number }, { V: number; m1: number; G1: number; f: number; R: number }],
    avg: stats.value?.avg ?? Number.NaN,
    relErrorPct: stats.value?.relErrorPct ?? Number.NaN,
  }),
})
</script>

<template>
  <div class="card">
    <div class="card-title">
      <span v-if="index" class="card-index">{{ index }}</span>
      <span class="card-name">还原糖分测定</span>
      <span class="card-method">兰-艾农恒容法</span>
    </div>

    <t-cell-group bordered>
      <div class="group-label">
        共享变量
        <t-tag
          v-if="hasAuto && !sucroseManual"
          theme="primary"
          size="small"
          variant="light"
          class="auto-tag"
        >
          蔗糖分自动取自上方平均值
        </t-tag>
        <t-tag v-else-if="hasAuto" theme="warning" size="small" variant="light" class="auto-tag">
          手动输入
        </t-tag>
        <span v-if="hasAuto && sucroseManual" class="auto-resume" @click="resumeAutoSucrose">恢复自动</span>
      </div>
      <LabInput
        :model-value="sucrose"
        label="蔗糖分 S"
        suffix="g/100g"
        placeholder="自动填充，可修改"
        :rule="ruleSucrose"
        @update:model-value="onSucroseInput"
      />
      <LabInput v-model="k" label="费林试剂校正系数 K" placeholder="默认 42.1/40≈1.0525" :rule="ruleK" />

      <div class="group-label">平行样 1</div>
      <LabInput v-model="run1.mass" label="称样质量 m₁" suffix="g" placeholder="如 26.0002" :rule="ruleRedMass" />
      <LabInput v-model="run1.v1" label="滴定体积 V₁ₐ" suffix="mL" placeholder="如 20.3" :rule="ruleVolume" />
      <LabInput v-model="run1.v2" label="滴定体积 V₁ᵦ" suffix="mL" placeholder="如 20.1" :rule="ruleVolume" />

      <div class="group-label">平行样 2</div>
      <LabInput v-model="run2.mass" label="称样质量 m₂" suffix="g" placeholder="如 26.0055" :rule="ruleRedMass" />
      <LabInput v-model="run2.v1" label="滴定体积 V₂ₐ" suffix="mL" placeholder="如 20" :rule="ruleVolume" />
      <LabInput v-model="run2.v2" label="滴定体积 V₂ᵦ" suffix="mL" placeholder="如 20" :rule="ruleVolume" />
    </t-cell-group>

    <!-- 公式与结果 -->
    <div class="formula-card">
      <div class="formula-header">
        计算公式与结果
        <span class="formula-header-note">m₁：100mL配制糖液含样品质量；G₁：滴定耗用配制糖液中含蔗糖量；f：由G₁查表2插值</span>
      </div>
      <div class="formula-item"><div class="formula-text">{{ v1Line }}</div></div>
      <div class="formula-item"><div class="formula-text">{{ v2Line }}</div></div>
      <div class="formula-item"><div class="formula-text">{{ m1Line }}</div></div>
      <div class="formula-item"><div class="formula-text">{{ m2Line }}</div></div>
      <div class="formula-item">
        <div class="formula-text">{{ g1Line }}</div>
        <div class="formula-sub">{{ f1Line }}</div>
        <div v-if="res1?.fOutOfRange" class="formula-warn">
          G₁ 超出表2范围（0~20g），f 取端点值，请核对数据
        </div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ g2Line }}</div>
        <div class="formula-sub">{{ f2Line }}</div>
        <div v-if="res2?.fOutOfRange" class="formula-warn">
          G₂ 超出表2范围（0~20g），f 取端点值，请核对数据
        </div>
      </div>
      <div class="formula-item"><div class="formula-text">{{ r1Line }}</div></div>
      <div class="formula-item"><div class="formula-text">{{ r2Line }}</div></div>
      <div class="formula-item"><div class="formula-text">{{ avgLine }}</div></div>
      <div class="formula-item result-line">
        <div class="formula-text">
          {{ errLine }}
          <t-tag v-if="stats" :theme="precisionPass ? 'success' : 'danger'" size="small">
            {{ precisionPass ? '≤15% 合格' : '超过15%精密度要求' }}
          </t-tag>
        </div>
      </div>
      <div class="final-result">
        <div class="final-label">还原糖分（保留3位有效数字）</div>
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
  flex-wrap: wrap;
}

.auto-tag {
  font-weight: 400;
}

.auto-resume {
  font-size: 12px;
  color: var(--lab-primary, #0052d9);
  text-decoration: underline;
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

.formula-sub {
  font-size: 12px;
  color: var(--td-text-color-secondary, rgba(0, 0, 0, 0.55));
  margin-top: 2px;
}

.formula-warn {
  font-size: 12px;
  color: var(--lab-warning, #e37318);
  margin-top: 2px;
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
