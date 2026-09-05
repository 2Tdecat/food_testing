<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import LabInput from '@/components/LabInput.vue'
import {
  TOTAL_SUGAR_DEFAULT_FLASK,
  TOTAL_SUGAR_DEFAULT_USE_VOLUME,
  calcTotalSugar,
  genTotalSugarRun2,
  RULE_DILUTION as ruleDilution,
  RULE_TITR_G as ruleG,
  RULE_TITR_MASS as ruleMass,
  RULE_TOTAL_SUGAR_USE_VOLUME as ruleUseVolume,
  RULE_VOLUME as ruleVolume,
  titrationPrecisionLimit,
  totalSugarStats,
  type TotalSugarMode,
  type ValidationRule,
} from '@/utils/sugarCalc'

/** 初始数据（历史记录编辑时回填） */
export interface TotalSugarInitial {
  mode: TotalSugarMode
  sucroseBasis: boolean
  g: number | null
  dilution: number | null
  /** 定容体积（mL，250 或 200，缺省 250） */
  flaskVolume?: number | null
  /** 取用体积（mL，缺省 50） */
  useVolume?: number | null
  runs: [
    { mass: number | null; volume: number | null },
    { mass: number | null; volume: number | null },
  ]
}

const props = defineProps<{
  /** 卡片序号（组合页为 2，独立页为空） */
  index?: number
  initial?: TotalSugarInitial
}>()

/** NaN 转为 null（历史记录中未填字段） */
function nn(v: number | null | undefined): number | null {
  return v === null || v === undefined || Number.isNaN(v) ? null : v
}

/* ---------------- 模式与共享输入 ---------------- */

/** 滴定模式：默认正滴，点击切换按钮直接切换（无需确认） */
const mode = ref<TotalSugarMode>('direct')

const modeLabel = computed(() => (mode.value === 'direct' ? '正滴（直接滴定）' : '反滴（反滴定）'))

/** 切换按钮文案：显示将切换到的模式 */
const toggleLabel = computed(() => (mode.value === 'direct' ? '切换反滴' : '切换正滴'))

function toggleMode() {
  mode.value = mode.value === 'direct' ? 'back' : 'direct'
}

/** 是否启用蔗糖计（×0.95，对应原 Excel 带"（蔗糖计）"的表） */
const sucroseBasis = ref(false)

const basisLabel = computed(() => (sucroseBasis.value ? '蔗糖计 ×0.95' : '蔗糖计未启用'))

function toggleBasis() {
  sucroseBasis.value = !sucroseBasis.value
}

/** 标定G量 */
const g = ref<number | null>(null)
/** 稀释倍数（正滴模式使用） */
const dilution = ref<number | null>(null)
/** 定容体积（mL）：250（默认）或 200（原表"定250/定200"） */
const flask = ref<number>(TOTAL_SUGAR_DEFAULT_FLASK)
/** 定容体积可选项（与原 Excel"定250/定200"备注一致） */
const FLASK_OPTIONS = [250, 200]

function onFlaskChange(v: number) {
  flask.value = v
}

/** 取用体积（mL）：滴定所取试样定容溶液体积，原表公式固定 50，正反滴均使用 */
const useVolume = ref<number | null>(TOTAL_SUGAR_DEFAULT_USE_VOLUME)

/** 公式展示用取用体积（输入清空时按默认 50 计算与展示） */
const uv = computed(() => useVolume.value ?? TOTAL_SUGAR_DEFAULT_USE_VOLUME)

/** 反滴模式下滴定量必须小于标定G量，否则含量为负 */
const volumeRule = computed<ValidationRule>(() => {
  if (mode.value !== 'back' || g.value === null) return ruleVolume
  return {
    ...ruleVolume,
    max: g.value,
    message: `反滴滴定量应小于标定G量 ${g.value}`,
  }
})

/* ---------------- 平行样输入 ---------------- */

const run1 = reactive({
  mass: null as number | null,
  volume: null as number | null,
})
const run2 = reactive({
  mass: null as number | null,
  volume: null as number | null,
})

/* ---------------- 平行样 2 自动生成 ---------------- */

/** 程序化回填期间不触发自动生成 */
const suppressGen = ref(false)

/** 依据平行样 1（及共享变量）生成平行样 2 数据 */
function genRun2() {
  const gen = genTotalSugarRun2(
    { mass: run1.mass, volume: run1.volume },
    {
      mode: mode.value,
      sucroseBasis: sucroseBasis.value,
      g: g.value,
      dilution: dilution.value,
      flaskVolume: flask.value,
      useVolume: uv.value,
    },
  )
  Object.assign(run2, gen ?? { mass: null, volume: null })
}

/* 平行样 1 / 共享变量 / 模式变化时自动生成平行样 2（误差满足精密度要求） */
watch(
  () => [
    run1.mass,
    run1.volume,
    g.value,
    dilution.value,
    flask.value,
    useVolume.value,
    mode.value,
    sucroseBasis.value,
  ],
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

function applyInitial(init: NonNullable<TotalSugarInitial>) {
  // 回填期间屏蔽自动生成，避免覆盖历史数据
  suppressGen.value = true
  mode.value = init.mode === 'back' ? 'back' : 'direct'
  sucroseBasis.value = !!init.sucroseBasis
  g.value = nn(init.g)
  dilution.value = nn(init.dilution)
  flask.value = init.flaskVolume === 200 ? 200 : TOTAL_SUGAR_DEFAULT_FLASK
  useVolume.value = nn(init.useVolume) ?? TOTAL_SUGAR_DEFAULT_USE_VOLUME
  Object.assign(run1, {
    mass: nn(init.runs[0]?.mass),
    volume: nn(init.runs[0]?.volume),
  })
  Object.assign(run2, {
    mass: nn(init.runs[1]?.mass),
    volume: nn(init.runs[1]?.volume),
  })
  nextTick(() => {
    suppressGen.value = false
  })
}

/* ---------------- 计算 ---------------- */

const shared = computed(() => ({
  mode: mode.value,
  sucroseBasis: sucroseBasis.value,
  g: g.value,
  dilution: dilution.value,
  flaskVolume: flask.value,
  useVolume: uv.value,
}))
const res1 = computed(() => calcTotalSugar(run1, shared.value))
const res2 = computed(() => calcTotalSugar(run2, shared.value))

/** 平行测定统计（平均值/误差/质量差取整规则与原 Excel 四表一致） */
const stats = computed(() => {
  if (res1.value === null || res2.value === null) return null
  return totalSugarStats(mode.value, sucroseBasis.value, res1.value, res2.value)
})

/** 精密度限值：正滴 ≤5%，反滴 ≤10%（GB 5009.7-2016） */
const precisionLimit = computed(() => titrationPrecisionLimit(mode.value))

const precisionPass = computed(
  () => stats.value !== null && Math.abs(stats.value.relErrorPct) <= precisionLimit.value,
)

/** 反滴模式滴定量与标定G量相等时含量为 0 */
const zeroContentWarn = computed(
  () =>
    mode.value === 'back' &&
    (res1.value === 0 || res2.value === 0) &&
    run1.volume !== null &&
    g.value !== null,
)

/* ---------------- 格式化 ---------------- */

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  const s = v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' ? '0' : s
}

/** 最终结果有效数字：含量 ≥10g/100g 三位，<10g/100g 两位（参照 GB 5009.7） */
function sigContent(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  return String(Number(v.toPrecision(v >= 10 ? 3 : 2)))
}

/* ---------------- 公式文本（与原 Excel 四表公式一致） ---------------- */

const content1Line = computed(() => {
  if (res1.value === null) return '含量₁ = --'
  if (mode.value === 'direct') {
    return sucroseBasis.value
      ? `含量₁ = G量 × 100 × 稀释倍数 × 100 × ${flask.value} / (m₁ × V₁ × ${uv.value} × 1000) × 0.95 = ${fmt(res1.value)} g/100g（保留2位小数）`
      : `含量₁ = G量 × 100 × 稀释倍数 × ${flask.value} × 100 / (${uv.value} × m₁ × V₁ × 1000) = ${fmt(res1.value)} g/100g（保留2位小数）`
  }
  return sucroseBasis.value
    ? `含量₁ = (G量 − V₁) × ${flask.value} × 100 × 0.95 × 100 / (${uv.value} × m₁ × 10 × 1000) = ${fmt(res1.value)} g/100g`
    : `含量₁ = (G量 − V₁) × ${flask.value} × 100 × 100 / (m₁ × 10 × 1000 × ${uv.value}) = ${fmt(res1.value)} g/100g`
})

const content2Line = computed(() => {
  if (res2.value === null) return '含量₂ = --'
  if (mode.value === 'direct') {
    return sucroseBasis.value
      ? `含量₂ = G量 × 100 × 稀释倍数 × 100 × ${flask.value} / (m₂ × V₂ × ${uv.value} × 1000) × 0.95 = ${fmt(res2.value)} g/100g（保留2位小数）`
      : `含量₂ = G量 × 100 × 稀释倍数 × ${flask.value} × 100 / (${uv.value} × m₂ × V₂ × 1000) = ${fmt(res2.value)} g/100g（保留2位小数）`
  }
  return sucroseBasis.value
    ? `含量₂ = (G量 − V₂) × ${flask.value} × 100 × 0.95 × 100 / (${uv.value} × m₂ × 10 × 1000) = ${fmt(res2.value)} g/100g`
    : `含量₂ = (G量 − V₂) × ${flask.value} × 100 × 100 / (m₂ × 10 × 1000 × ${uv.value}) = ${fmt(res2.value)} g/100g`
})

const avgLine = computed(() =>
  stats.value
    ? `平均值 = (含量₁ + 含量₂) / 2 = (${fmt(res1.value)} + ${fmt(res2.value)}) / 2 = ${fmt(stats.value.avg)} g/100g${
        mode.value === 'direct' ? '（保留1位小数）' : ''
      }`
    : '平均值 = --',
)

const errLine = computed(() =>
  stats.value
    ? `误差 = (含量₁ − 含量₂) × 100 / 平均值 = ${fmt(stats.value.relErrorPct)}%${
        mode.value === 'direct' || sucroseBasis.value ? '' : '（保留1位小数）'
      }`
    : '误差 = --',
)

const diffLine = computed(() =>
  stats.value
    ? `质量差 = ${mode.value === 'direct' ? '含量₂ − 含量₁' : '含量₁ − 含量₂'} = ${fmt(stats.value.massDiff)} g/100g`
    : '质量差 = --',
)

/* ---------------- 对外暴露（保存记录用） ---------------- */

defineExpose({
  /** 重置所有输入（恢复默认正滴模式） */
  reset: () => {
    mode.value = 'direct'
    sucroseBasis.value = false
    g.value = null
    dilution.value = null
    flask.value = TOTAL_SUGAR_DEFAULT_FLASK
    useVolume.value = TOTAL_SUGAR_DEFAULT_USE_VOLUME
    Object.assign(run1, { mass: null, volume: null })
    Object.assign(run2, { mass: null, volume: null })
  },
  /** 用给定数据回填（NaN 视为空） */
  load: (init: NonNullable<TotalSugarInitial>) => applyInitial(init),
  /** 依据当前平行样 1 重新生成平行样 2 */
  regenerate: genRun2,
  /** 数据是否完整可保存 */
  isComplete: computed(
    () =>
      res1.value !== null &&
      res2.value !== null &&
      stats.value !== null &&
      g.value !== null &&
      run1.mass !== null &&
      run2.mass !== null &&
      (mode.value === 'back' || dilution.value !== null),
  ),
  /** 构建保存记录所需数据 */
  snapshot: () => ({
    mode: mode.value,
    sucroseBasis: sucroseBasis.value,
    g: g.value ?? Number.NaN,
    dilution: mode.value === 'direct' ? dilution.value : null,
    flaskVolume: mode.value === 'direct' ? flask.value : null,
    useVolume: uv.value,
    runs: [{ ...run1 }, { ...run2 }] as [
      { mass: number | null; volume: number | null },
      { mass: number | null; volume: number | null },
    ],
    content: [res1.value ?? Number.NaN, res2.value ?? Number.NaN] as [number, number],
    avg: stats.value?.avg ?? Number.NaN,
    relErrorPct: stats.value?.relErrorPct ?? Number.NaN,
    massDiff: stats.value?.massDiff ?? Number.NaN,
  }),
})
</script>

<template>
  <div class="card">
    <div class="card-title">
      <span v-if="index" class="card-index">{{ index }}</span>
      <span class="card-name">总糖测定</span>
      <span class="card-method">{{ modeLabel }}{{ sucroseBasis ? ' · 蔗糖计' : '' }}</span>
      <button type="button" class="mode-toggle" @click="toggleMode">{{ toggleLabel }}</button>
    </div>

    <t-cell-group bordered>
      <div class="basis-row">
        <span class="basis-label">是否启用蔗糖计</span>
        <button
          type="button"
          class="basis-toggle"
          :class="{ 'basis-toggle--active': sucroseBasis }"
          @click="toggleBasis"
        >
          {{ basisLabel }}
        </button>
      </div>

      <div class="group-label">共享变量</div>
      <LabInput v-model="g" label="标定G量" suffix="mL" placeholder="如 11.45" :rule="ruleG" />
      <LabInput
        v-if="mode === 'direct'"
        v-model="dilution"
        label="稀释倍数"
        placeholder="如 4"
        :rule="ruleDilution"
      />
      <div v-if="mode === 'direct'" class="flask-row">
        <span class="flask-label">定容体积</span>
        <div class="flask-options">
          <button
            v-for="opt in FLASK_OPTIONS"
            :key="opt"
            type="button"
            class="flask-option"
            :class="{ 'flask-option--active': flask === opt }"
            @click="onFlaskChange(opt)"
          >
            {{ opt }}mL
          </button>
        </div>
      </div>
      <LabInput
        v-model="useVolume"
        label="取用体积"
        suffix="mL"
        placeholder="如 50"
        :rule="ruleUseVolume"
      />

      <div class="group-label">平行样 1</div>
      <LabInput
        v-model="run1.mass"
        label="称样量 m₁"
        suffix="g"
        placeholder="如 2.5337"
        :rule="ruleMass"
      />
      <LabInput
        v-model="run1.volume"
        label="滴定量 V₁"
        suffix="mL"
        placeholder="如 9.8"
        :rule="volumeRule"
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
        label="称样量 m₂"
        suffix="g"
        placeholder="填写平行样 1 后自动生成"
        :rule="ruleMass"
        readonly
      />
      <LabInput
        v-model="run2.volume"
        label="滴定量 V₂"
        suffix="mL"
        placeholder="自动生成"
        :rule="volumeRule"
        readonly
      />
    </t-cell-group>

    <!-- 公式与结果 -->
    <div class="formula-card">
      <div class="formula-header">
        计算公式与结果
        <span class="formula-header-note">
          {{
            mode === 'direct'
              ? sucroseBasis
                ? `总糖正滴（蔗糖计）：含量 = G量 × 100 × 稀释倍数 × 100 × ${flask} / (称样量 × 滴定量 × ${uv} × 1000) × 0.95`
                : `总糖正滴：含量 = G量 × 100 × 稀释倍数 × ${flask} × 100 / (${uv} × 称样量 × 滴定量 × 1000)，${flask} 为定容体积（原表"定${flask}"），${uv} 为取用体积`
              : sucroseBasis
                ? `总糖反滴（蔗糖计）：含量 = (G量 − 滴定量) × ${flask} × 100 × 0.95 × 100 / (${uv} × 称样量 × 10 × 1000)`
                : `总糖反滴：含量 = (G量 − 滴定量) × ${flask} × 100 × 100 / (称样量 × 10 × 1000 × ${uv})`
          }}
        </span>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ content1Line }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ content2Line }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ avgLine }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">
          {{ errLine }}
          <t-tag v-if="stats" :theme="precisionPass ? 'success' : 'danger'" size="small">
            {{ precisionPass ? `≤${precisionLimit}% 合格` : `超过${precisionLimit}%精密度要求` }}
          </t-tag>
        </div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ diffLine }}</div>
      </div>
      <div v-if="zeroContentWarn" class="formula-warn">
        反滴滴定量不小于标定G量，糖含量为 0，请核对数据
      </div>
      <div class="final-result">
        <div class="final-label">总糖含量（按 GB 5009.7 保留有效数字）</div>
        <div class="final-value">{{ stats ? `${sigContent(stats.avg)} g/100g` : '--' }}</div>
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

.mode-toggle {
  margin-left: auto;
  border: 1px solid var(--lab-primary, #0052d9);
  background: rgba(0, 82, 217, 0.06);
  color: var(--lab-primary, #0052d9);
  border-radius: 14px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  flex-shrink: 0;
}

.basis-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.basis-label {
  font-size: 14px;
  color: var(--td-text-color-primary, rgba(0, 0, 0, 0.9));
}

.basis-toggle {
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 14px;
  padding: 4px 14px;
  font-size: 13px;
  color: var(--td-text-color-secondary, rgba(0, 0, 0, 0.55));
  cursor: pointer;
}

.basis-toggle--active {
  border-color: var(--lab-primary, #0052d9);
  color: var(--lab-primary, #0052d9);
  background: rgba(0, 82, 217, 0.06);
  font-weight: 600;
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

.regen {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: var(--lab-primary, #0052d9);
  text-decoration: underline;
  padding: 4px;
}

.flask-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.flask-label {
  font-size: 14px;
  color: var(--td-text-color-primary, rgba(0, 0, 0, 0.9));
}

.flask-options {
  display: flex;
  gap: 8px;
}

.flask-option {
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 6px;
  padding: 5px 14px;
  font-size: 13px;
  color: var(--td-text-color-primary, rgba(0, 0, 0, 0.9));
  cursor: pointer;
}

.flask-option--active {
  border-color: var(--lab-primary, #0052d9);
  color: var(--lab-primary, #0052d9);
  background: rgba(0, 82, 217, 0.06);
  font-weight: 600;
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

.formula-warn {
  font-size: 12px;
  color: var(--lab-warning, #e37318);
  margin-top: 2px;
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
