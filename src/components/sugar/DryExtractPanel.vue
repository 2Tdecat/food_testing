<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import LabInput from '@/components/LabInput.vue'
import {
  DRY_EXTRACT_PRECISION_LIMIT,
  RULE_DE_DENSITY as ruleDensity,
  RULE_DE_SUGAR as ruleSugar,
  RULE_DE_TOTAL_EXTRACT as ruleTotalExtract,
  calcDryExtract,
  dryExtractStats,
  genDryExtractRun2,
} from '@/utils/sugarCalc'

/** 初始数据（历史记录编辑时回填） */
export interface DryExtractInitial {
  totalSugar: number | null
  reducingSugar: number | null
  roundResult: boolean
  runs: [
    {
      densityOriginal: number | null
      densityDistilled: number | null
      totalExtract: number | null
    },
    {
      densityOriginal: number | null
      densityDistilled: number | null
      totalExtract: number | null
    },
  ]
}

const props = defineProps<{
  /** 卡片序号（组合页为 2，独立页为空） */
  index?: number
  initial?: DryExtractInitial
}>()

/** NaN 转为 null（历史记录中未填字段） */
function nn(v: number | null | undefined): number | null {
  return v === null || v === undefined || Number.isNaN(v) ? null : v
}

/* ---------------- 共享输入 ---------------- */

/** 总糖（g/L，两平行样共享） */
const totalSugar = ref<number | null>(null)
/** 还原糖（g/L，两平行样共享） */
const reducingSugar = ref<number | null>(null)
/** 干浸出物结果是否保留 2 位小数（原表两种公式形态，默认不取整与多数行一致） */
const roundResult = ref(false)

const ROUND_OPTIONS = [
  { value: false, label: '不取整' },
  { value: true, label: '保留2位' },
]

/** 总糖小于还原糖时蔗糖为负（原表未见此情形），给出提示 */
const sugarOrderWarn = computed(
  () =>
    totalSugar.value !== null &&
    reducingSugar.value !== null &&
    totalSugar.value < reducingSugar.value,
)

/* ---------------- 平行样输入 ---------------- */

const run1 = reactive({
  densityOriginal: null as number | null,
  densityDistilled: null as number | null,
  totalExtract: null as number | null,
})
const run2 = reactive({
  densityOriginal: null as number | null,
  densityDistilled: null as number | null,
  totalExtract: null as number | null,
})

/* ---------------- 平行样 2 自动生成 ---------------- */

/** 程序化回填期间不触发自动生成 */
const suppressGen = ref(false)

/** 依据平行样 1（及共享变量）生成平行样 2 数据 */
function genRun2() {
  const gen = genDryExtractRun2(
    { ...run1 },
    {
      totalSugar: totalSugar.value,
      reducingSugar: reducingSugar.value,
      roundResult: roundResult.value,
    },
  )
  Object.assign(run2, gen ?? { densityOriginal: null, densityDistilled: null, totalExtract: null })
}

/* 平行样 1 / 共享变量变化时自动生成平行样 2（误差满足精密度要求） */
watch(
  () => [
    run1.densityOriginal,
    run1.densityDistilled,
    run1.totalExtract,
    totalSugar.value,
    reducingSugar.value,
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

function applyInitial(init: NonNullable<DryExtractInitial>) {
  // 回填期间屏蔽自动生成，避免覆盖历史数据
  suppressGen.value = true
  totalSugar.value = nn(init.totalSugar)
  reducingSugar.value = nn(init.reducingSugar)
  roundResult.value = !!init.roundResult
  Object.assign(run1, {
    densityOriginal: nn(init.runs[0]?.densityOriginal),
    densityDistilled: nn(init.runs[0]?.densityDistilled),
    totalExtract: nn(init.runs[0]?.totalExtract),
  })
  Object.assign(run2, {
    densityOriginal: nn(init.runs[1]?.densityOriginal),
    densityDistilled: nn(init.runs[1]?.densityDistilled),
    totalExtract: nn(init.runs[1]?.totalExtract),
  })
  nextTick(() => {
    suppressGen.value = false
  })
}

/* ---------------- 计算 ---------------- */

const shared = computed(() => ({
  totalSugar: totalSugar.value,
  reducingSugar: reducingSugar.value,
  roundResult: roundResult.value,
}))
const res1 = computed(() => calcDryExtract(run1, shared.value))
const res2 = computed(() => calcDryExtract(run2, shared.value))

/** 平行测定统计（平均值/误差） */
const stats = computed(() => {
  if (res1.value === null || res2.value === null) return null
  return dryExtractStats(res1.value.dryExtract, res2.value.dryExtract)
})

/** 精密度限值：两次独立测定结果绝对差值 ≤ 算术平均值的 2%（GB/T 15038-2006 4.3.5） */
const precisionPass = computed(
  () => stats.value !== null && Math.abs(stats.value.relErrorPct) <= DRY_EXTRACT_PRECISION_LIMIT,
)

/** 干浸出物结果为负（总干浸出物不足糖之和），原表亦存在此类数据，仅提示 */
const negativeWarn = computed(
  () =>
    (res1.value !== null && res1.value.dryExtract < 0) ||
    (res2.value !== null && res2.value.dryExtract < 0),
)

/* ---------------- 格式化 ---------------- */

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  const s = v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' ? '0' : s
}

/* ---------------- 公式文本（与原 Excel"干浸出物"表公式一致） ---------------- */

function densityLine(no: 1 | 2, res: { density: number } | null): string {
  if (res === null) return `密度${no} = --`
  return `密度${no} = (原液密度${no} × 1000 − 蒸馏液密度${no} × 1000 + 1000) / 1000 = ${fmt(res.density)} g/mL（保留4位小数）`
}

function extractLine(no: 1 | 2, res: { dryExtract: number } | null, te: number | null): string {
  if (res === null || te === null) return `干浸出物${no} = --`
  return `干浸出物${no} = 总干浸出物${no} − 还原糖 − 蔗糖 = ${fmt(te)} − ${fmt(
    reducingSugar.value,
  )} − ${fmt(sucroseVal.value)} = ${fmt(res.dryExtract)} g/L${roundResult.value ? '（保留2位小数）' : ''}`
}

/** 蔗糖（共享，= (总糖 − 还原糖) × 0.95） */
const sucroseVal = computed(() =>
  totalSugar.value !== null && reducingSugar.value !== null
    ? (totalSugar.value - reducingSugar.value) * 0.95
    : null,
)

const sucroseLine = computed(() => {
  if (sucroseVal.value === null) return '蔗糖 = --'
  return `蔗糖 = (总糖 − 还原糖) × 0.95 = (${fmt(totalSugar.value)} − ${fmt(
    reducingSugar.value,
  )}) × 0.95 = ${fmt(sucroseVal.value)} g/L`
})

const avgLine = computed(() =>
  stats.value
    ? `平均值 = (干浸出物1 + 干浸出物2) / 2 = (${fmt(res1.value?.dryExtract)} + ${fmt(
        res2.value?.dryExtract,
      )}) / 2 = ${fmt(stats.value.avg)} g/L`
    : '平均值 = --',
)

const errLine = computed(() =>
  stats.value
    ? `误差 = (干浸出物1 − 干浸出物2) × 100 / 平均值 = ${fmt(stats.value.relErrorPct)}%`
    : '误差 = --',
)

/* ---------------- 对外暴露（保存记录用） ---------------- */

defineExpose({
  /** 重置所有输入 */
  reset: () => {
    totalSugar.value = null
    reducingSugar.value = null
    roundResult.value = false
    Object.assign(run1, { densityOriginal: null, densityDistilled: null, totalExtract: null })
    Object.assign(run2, { densityOriginal: null, densityDistilled: null, totalExtract: null })
  },
  /** 用给定数据回填（NaN 视为空） */
  load: (init: NonNullable<DryExtractInitial>) => applyInitial(init),
  /** 依据当前平行样 1 重新生成平行样 2 */
  regenerate: genRun2,
  /** 数据是否完整可保存 */
  isComplete: computed(
    () =>
      res1.value !== null &&
      res2.value !== null &&
      stats.value !== null &&
      totalSugar.value !== null &&
      reducingSugar.value !== null &&
      run1.totalExtract !== null &&
      run2.totalExtract !== null,
  ),
  /** 构建保存记录所需数据 */
  snapshot: () => ({
    totalSugar: totalSugar.value ?? Number.NaN,
    reducingSugar: reducingSugar.value ?? Number.NaN,
    roundResult: roundResult.value,
    runs: [{ ...run1 }, { ...run2 }] as [
      {
        densityOriginal: number | null
        densityDistilled: number | null
        totalExtract: number | null
      },
      {
        densityOriginal: number | null
        densityDistilled: number | null
        totalExtract: number | null
      },
    ],
    content: [res1.value?.dryExtract ?? Number.NaN, res2.value?.dryExtract ?? Number.NaN] as [
      number,
      number,
    ],
    avg: stats.value?.avg ?? Number.NaN,
    relErrorPct: stats.value?.relErrorPct ?? Number.NaN,
  }),
})
</script>

<template>
  <div class="card">
    <div class="card-title">
      <span v-if="index" class="card-index">{{ index }}</span>
      <span class="card-name">干浸出物测定</span>
      <span class="card-method">密度法（GB/T 15038）</span>
    </div>

    <t-cell-group bordered>
      <div class="round-row">
        <span class="round-label">干浸出物结果</span>
        <div class="round-options">
          <button
            v-for="opt in ROUND_OPTIONS"
            :key="opt.label"
            type="button"
            class="round-option"
            :class="{ 'round-option--active': roundResult === opt.value }"
            @click="roundResult = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="group-label">共享变量（两平行样相同）</div>
      <LabInput
        v-model="totalSugar"
        label="总糖"
        suffix="g/L"
        placeholder="如 54.3"
        :rule="ruleSugar"
      />
      <LabInput
        v-model="reducingSugar"
        label="还原糖"
        suffix="g/L"
        placeholder="如 53.5"
        :rule="ruleSugar"
      />

      <div class="group-label">平行样 1</div>
      <LabInput
        v-model="run1.densityOriginal"
        label="原液密度"
        suffix="g/mL"
        placeholder="如 0.9908"
        :rule="ruleDensity"
      />
      <LabInput
        v-model="run1.densityDistilled"
        label="蒸馏液密度"
        suffix="g/mL"
        placeholder="如 0.9827"
        :rule="ruleDensity"
      />
      <LabInput
        v-model="run1.totalExtract"
        label="总干浸出物"
        suffix="g/L"
        placeholder="如 20.9"
        :rule="ruleTotalExtract"
      />

      <div class="group-label">
        平行样 2
        <t-tag theme="primary" size="small" variant="light" class="auto-tag"
          >由平行样 1 自动生成</t-tag
        >
        <span class="regen" @click="genRun2">重新生成</span>
      </div>
      <LabInput
        v-model="run2.densityOriginal"
        label="原液密度"
        suffix="g/mL"
        placeholder="填写平行样 1 后自动生成"
        :rule="ruleDensity"
        readonly
      />
      <LabInput
        v-model="run2.densityDistilled"
        label="蒸馏液密度"
        suffix="g/mL"
        placeholder="自动生成"
        :rule="ruleDensity"
        readonly
      />
      <LabInput
        v-model="run2.totalExtract"
        label="总干浸出物"
        suffix="g/L"
        placeholder="自动生成"
        :rule="ruleTotalExtract"
        readonly
      />
    </t-cell-group>

    <!-- 公式与结果 -->
    <div class="formula-card">
      <div class="formula-header">
        计算公式与结果
        <span class="formula-header-note">
          密度 = (原液密度×1000 − 蒸馏液密度×1000 + 1000)/1000；总干浸出物由密度查 GB/T 15038 附录 C
          对照表；蔗糖 = (总糖 − 还原糖)×0.95；干浸出物 = 总干浸出物 − 还原糖 − 蔗糖
        </span>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ densityLine(1, res1) }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ densityLine(2, res2) }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ sucroseLine }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ extractLine(1, res1, run1.totalExtract) }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ extractLine(2, res2, run2.totalExtract) }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">{{ avgLine }}</div>
      </div>
      <div class="formula-item">
        <div class="formula-text">
          {{ errLine }}
          <t-tag v-if="stats" :theme="precisionPass ? 'success' : 'danger'" size="small">
            {{
              precisionPass
                ? `≤${DRY_EXTRACT_PRECISION_LIMIT}% 合格`
                : `超过${DRY_EXTRACT_PRECISION_LIMIT}%精密度要求`
            }}
          </t-tag>
        </div>
      </div>
      <div v-if="sugarOrderWarn" class="formula-warn">总糖小于还原糖，蔗糖为负，请核对数据</div>
      <div v-if="negativeWarn" class="formula-warn">
        干浸出物结果为负（总干浸出物小于糖量之和），请核对总干浸出物与糖数据
      </div>
      <div class="final-result">
        <div class="final-label">干浸出物平均值</div>
        <div class="final-value">{{ stats ? `${fmt(stats.avg)} g/L` : '--' }}</div>
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

.regen {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: var(--lab-primary, #0052d9);
  text-decoration: underline;
  padding: 4px;
}

.round-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.round-label {
  font-size: 14px;
  color: var(--td-text-color-primary, rgba(0, 0, 0, 0.9));
}

.round-options {
  display: flex;
  gap: 8px;
}

.round-option {
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 6px;
  padding: 5px 14px;
  font-size: 13px;
  color: var(--td-text-color-primary, rgba(0, 0, 0, 0.9));
  cursor: pointer;
}

.round-option--active {
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
