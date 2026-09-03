<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LabInput from '@/components/LabInput.vue'
import type { ValidationRule } from '@/utils/sugarCalc'
import {
  calcReducing,
  calcSucrose,
  duplicateStats,
  sigDigits,
} from '@/utils/sugarCalc'

const router = useRouter()

/* ---------------- 变量校验规则（依据 QB/T 8040-2024） ---------------- */

/** 称样量 65.000g±0.002（标准 5.4.2） */
const ruleSucMass: ValidationRule = {
  min: 64.5,
  max: 65.5,
  warnMin: 64.998,
  warnMax: 65.002,
  message: '称样量应约 65g',
  warnMessage: '标准规定称样量 65.000g±0.002g',
}
/** 检糖计测量范围 −30°Z~+120°Z（标准 5.2.1） */
const rulePolar: ValidationRule = { min: -30, max: 120, message: '检糖计测量范围 −30°Z~+120°Z' }
/** 干燥失重 */
const ruleLoss: ValidationRule = { min: 0, max: 15, message: '干燥失重应在 0~15 g/100g 之间' }
/** 糖液温度 */
const ruleTemp: ValidationRule = {
  min: 10,
  max: 35,
  warnMin: 18,
  warnMax: 25,
  message: '温度应在 10~35 ℃ 之间',
  warnMessage: '温度偏离 20℃ 较大，注意温度校正',
}
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

/* ---------------- 蔗糖分（二次旋光法）输入 ---------------- */

const sucShared = reactive({ loss: null as number | null, temp: null as number | null })
const suc1 = reactive({
  mass: null as number | null,
  directP: null as number | null,
  invertP: null as number | null,
})
const suc2 = reactive({
  mass: null as number | null,
  directP: null as number | null,
  invertP: null as number | null,
})

const sucRes1 = computed(() => calcSucrose(suc1, sucShared))
const sucRes2 = computed(() => calcSucrose(suc2, sucShared))

/** 蔗糖分平行测定统计（精密度 ≤0.05%，标准 5.4.5） */
const sucStats = computed(() => {
  if (!sucRes1.value || !sucRes2.value) return null
  return duplicateStats(sucRes1.value.S, sucRes2.value.S)
})

/* ---------------- 还原糖分（兰-艾农恒容法）输入 ---------------- */

/** 蔗糖分 S：默认自动取蔗糖分测定平均值，可手动修改 */
const redSucrose = ref<number | null>(null)
const redSucroseManual = ref(false)

watch(
  () => sucStats.value?.avg ?? null,
  (v) => {
    if (!redSucroseManual.value) redSucrose.value = v
  },
)

function resumeAutoSucrose() {
  redSucroseManual.value = false
  redSucrose.value = sucStats.value?.avg ?? null
}

function onRedSucroseInput(v: number | null) {
  redSucroseManual.value = true
  redSucrose.value = v
}

/** 费林溶液浓度校正系数（默认 42.1/40≈1.0525） */
const redK = ref<number | null>(1.0525)

const red1 = reactive({
  mass: null as number | null,
  v1: null as number | null,
  v2: null as number | null,
})
const red2 = reactive({
  mass: null as number | null,
  v1: null as number | null,
  v2: null as number | null,
})

const redShared = computed(() => ({ sucrose: redSucrose.value, k: redK.value }))
const redRes1 = computed(() => calcReducing(red1, redShared.value))
const redRes2 = computed(() => calcReducing(red2, redShared.value))

/** 还原糖分平行测定统计（精密度 ≤15%，标准 6.6） */
const redStats = computed(() => {
  if (!redRes1.value || !redRes2.value) return null
  return duplicateStats(redRes1.value.R, redRes2.value.R)
})

/* ---------------- 格式化 ---------------- */

/** 数值格式化：最多 4 位小数，去掉末尾 0 */
function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '--'
  const s = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' ? '0' : s
}

/** 负数加括号显示 */
function fp(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '--'
  return n < 0 ? `(${fmt(n)})` : fmt(n)
}

/* ---------------- 公式文本（计算结果上方展示） ---------------- */

const sucGLine = computed(
  () => `G = 13 × (100 − ${fp(sucShared.loss)}) / 100 = ${fp(sucRes1.value?.G)} g`,
)

const sucS1Line = computed(() => {
  if (!sucRes1.value) return 'S₁ = --'
  return `S₁ = 200 × (${fmt(suc1.directP)} − ${fp(suc1.invertP)}) / (132.56 − 0.0794 × (13 − ${fmt(
    sucRes1.value.G,
  )}) − 0.53 × (${fmt(sucShared.temp)} − 20)) = ${fmt(sucRes1.value.S)} g/100g`
})

const sucS2Line = computed(() => {
  if (!sucRes2.value) return 'S₂ = --'
  return `S₂ = 200 × (${fmt(suc2.directP)} − ${fp(suc2.invertP)}) / (132.56 − 0.0794 × (13 − ${fmt(
    sucRes2.value.G,
  )}) − 0.53 × (${fmt(sucShared.temp)} − 20)) = ${fmt(sucRes2.value.S)} g/100g`
})

const sucAvgLine = computed(() =>
  sucStats.value
    ? `S̄ = (S₁ + S₂) / 2 = ${fmt(sucStats.value.avg)} g/100g`
    : 'S̄ = --',
)

const sucErrLine = computed(() =>
  sucStats.value ? `相对误差 = |S₁ − S₂| / S̄ × 100 = ${fmt(sucStats.value.relErrorPct)}%` : '相对误差 = --',
)

const sucPrecisionPass = computed(() =>
  sucStats.value !== null && sucStats.value.relErrorPct <= 0.05,
)

const redV1Line = computed(() =>
  redRes1.value
    ? `V₁ = (${fmt(red1.v1)} + ${fmt(red1.v2)}) / 2 = ${fmt(redRes1.value.V)} mL`
    : 'V₁ = --',
)

const redV2Line = computed(() =>
  redRes2.value
    ? `V₂ = (${fmt(red2.v1)} + ${fmt(red2.v2)}) / 2 = ${fmt(redRes2.value.V)} mL`
    : 'V₂ = --',
)

const redM1Line = computed(() =>
  redRes1.value ? `m₁ = ${fmt(red1.mass)} × 100 / 200 = ${fmt(redRes1.value.m1)} g` : 'm₁ = --',
)

const redM2Line = computed(() =>
  redRes2.value ? `m₂ = ${fmt(red2.mass)} × 100 / 200 = ${fmt(redRes2.value.m1)} g` : 'm₂ = --',
)

const redG1Line = computed(() =>
  redRes1.value
    ? `G₁ = m₁ × S × V₁ / 10000 = ${fmt(redRes1.value.m1)} × ${fmt(redSucrose.value)} × ${fmt(
        redRes1.value.V,
      )} / 10000 = ${fmt(redRes1.value.G1)} g`
    : 'G₁ = --',
)

const redG2Line = computed(() =>
  redRes2.value
    ? `G₂ = m₂ × S × V₂ / 10000 = ${fmt(redRes2.value.m1)} × ${fmt(redSucrose.value)} × ${fmt(
        redRes2.value.V,
      )} / 10000 = ${fmt(redRes2.value.G1)} g`
    : 'G₂ = --',
)

const redF1Line = computed(() =>
  redRes1.value ? `f₁ = ${fmt(redRes1.value.f)}（由 G₁ 查表2线性插值）` : 'f₁ = --',
)

const redF2Line = computed(() =>
  redRes2.value ? `f₂ = ${fmt(redRes2.value.f)}（由 G₂ 查表2线性插值）` : 'f₂ = --',
)

const redR1Line = computed(() =>
  redRes1.value
    ? `R₁ = 1000 × f₁ × K / (m₁ × V₁) = ${fmt(redRes1.value.R)} g/100g`
    : 'R₁ = --',
)

const redR2Line = computed(() =>
  redRes2.value
    ? `R₂ = 1000 × f₂ × K / (m₂ × V₂) = ${fmt(redRes2.value.R)} g/100g`
    : 'R₂ = --',
)

const redAvgLine = computed(() =>
  redStats.value ? `R̄ = (R₁ + R₂) / 2 = ${fmt(redStats.value.avg)} g/100g` : 'R̄ = --',
)

const redErrLine = computed(() =>
  redStats.value ? `相对误差 = |R₁ − R₂| / R̄ × 100 = ${fmt(redStats.value.relErrorPct)}%` : '相对误差 = --',
)

const redPrecisionPass = computed(() =>
  redStats.value !== null && redStats.value.relErrorPct <= 15,
)

function resetAll() {
  sucShared.loss = null
  sucShared.temp = null
  Object.assign(suc1, { mass: null, directP: null, invertP: null })
  Object.assign(suc2, { mass: null, directP: null, invertP: null })
  redSucroseManual.value = false
  redSucrose.value = null
  redK.value = 1.0525
  Object.assign(red1, { mass: null, v1: null, v2: null })
  Object.assign(red2, { mass: null, v1: null, v2: null })
}
</script>

<template>
  <div class="page">
    <t-navbar title="糖分计算" fixed placeholder @left-click="router.back()">
      <template #left>
        <t-icon name="chevron-left" size="24px" />
      </template>
    </t-navbar>

    <div class="body">
      <t-notice-bar
        class="notice"
        content="依据 QB/T 8040-2024《赤砂糖试验方法》：蔗糖分用二次旋光法，还原糖分用兰-艾农恒容法，平行测定结果取算术平均值"
        marquee
      />

      <!-- ================= 蔗糖分 ================= -->
      <div class="card">
        <div class="card-title">
          <span class="card-index">1</span>
          <span class="card-name">蔗糖分测定</span>
          <span class="card-method">二次旋光法</span>
        </div>

        <t-cell-group bordered>
          <div class="group-label">共享变量</div>
          <LabInput
            v-model="sucShared.loss"
            label="干燥失重 Q"
            suffix="g/100g"
            placeholder="如 1.6"
            :rule="ruleLoss"
          />
          <LabInput
            v-model="sucShared.temp"
            label="糖液温度 t"
            suffix="℃"
            placeholder="如 20.1"
            :rule="ruleTemp"
          />

          <div class="group-label">平行样 1</div>
          <LabInput v-model="suc1.mass" label="称样质量 m₁" suffix="g" placeholder="如 65.0002" :rule="ruleSucMass" />
          <LabInput v-model="suc1.directP" label="直接旋光读数 P₁" suffix="°Z" placeholder="如 46.54" :rule="rulePolar" />
          <LabInput v-model="suc1.invertP" label="转化旋光读数 P₁′" suffix="°Z" placeholder="如 -15.63" :rule="rulePolar" />

          <div class="group-label">平行样 2</div>
          <LabInput v-model="suc2.mass" label="称样质量 m₂" suffix="g" placeholder="如 65.0012" :rule="ruleSucMass" />
          <LabInput v-model="suc2.directP" label="直接旋光读数 P₂" suffix="°Z" placeholder="如 46.68" :rule="rulePolar" />
          <LabInput v-model="suc2.invertP" label="转化旋光读数 P₂′" suffix="°Z" placeholder="如 -15.46" :rule="rulePolar" />
        </t-cell-group>

        <!-- 公式与结果 -->
        <div class="formula-card">
          <div class="formula-header">
            计算公式与结果
            <span class="formula-header-note">G：每100mL转化糖液内干固物质量；S：蔗糖分</span>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ sucGLine }}</div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ sucS1Line }}</div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ sucS2Line }}</div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ sucAvgLine }}</div>
          </div>
          <div class="formula-item result-line">
            <div class="formula-text">
              {{ sucErrLine }}
              <t-tag v-if="sucStats" :theme="sucPrecisionPass ? 'success' : 'danger'" size="small">
                {{ sucPrecisionPass ? '≤0.05% 合格' : '超过0.05%精密度要求' }}
              </t-tag>
            </div>
          </div>
          <div class="final-result">
            <div class="final-label">蔗糖分（保留3位有效数字）</div>
            <div class="final-value">
              {{ sucStats ? `${sigDigits(sucStats.avg)} g/100g` : '--' }}
            </div>
          </div>
        </div>
      </div>

      <!-- ================= 还原糖分 ================= -->
      <div class="card">
        <div class="card-title">
          <span class="card-index">2</span>
          <span class="card-name">还原糖分测定</span>
          <span class="card-method">兰-艾农恒容法</span>
        </div>

        <t-cell-group bordered>
          <div class="group-label">
            共享变量
            <t-tag
              v-if="!redSucroseManual"
              theme="primary"
              size="small"
              variant="light"
              class="auto-tag"
            >
              蔗糖分自动取自上方平均值
            </t-tag>
            <t-tag v-else theme="warning" size="small" variant="light" class="auto-tag">
              手动输入
            </t-tag>
            <span v-if="redSucroseManual" class="auto-resume" @click="resumeAutoSucrose">恢复自动</span>
          </div>
          <LabInput
            :model-value="redSucrose"
            label="蔗糖分 S"
            suffix="g/100g"
            placeholder="自动填充，可修改"
            :rule="ruleSucrose"
            @update:model-value="onRedSucroseInput"
          />
          <LabInput
            v-model="redK"
            label="费林试剂校正系数 K"
            placeholder="默认 42.1/40≈1.0525"
            :rule="ruleK"
          />

          <div class="group-label">平行样 1</div>
          <LabInput v-model="red1.mass" label="称样质量 m₁" suffix="g" placeholder="如 26.0002" :rule="ruleRedMass" />
          <LabInput v-model="red1.v1" label="滴定体积 V₁ₐ" suffix="mL" placeholder="如 20.3" :rule="ruleVolume" />
          <LabInput v-model="red1.v2" label="滴定体积 V₁ᵦ" suffix="mL" placeholder="如 20.1" :rule="ruleVolume" />

          <div class="group-label">平行样 2</div>
          <LabInput v-model="red2.mass" label="称样质量 m₂" suffix="g" placeholder="如 26.0055" :rule="ruleRedMass" />
          <LabInput v-model="red2.v1" label="滴定体积 V₂ₐ" suffix="mL" placeholder="如 20" :rule="ruleVolume" />
          <LabInput v-model="red2.v2" label="滴定体积 V₂ᵦ" suffix="mL" placeholder="如 20" :rule="ruleVolume" />
        </t-cell-group>

        <!-- 公式与结果 -->
        <div class="formula-card">
          <div class="formula-header">
            计算公式与结果
            <span class="formula-header-note">m₁：100mL配制糖液含样品质量；G₁：滴定耗用配制糖液中含蔗糖量；f：由G₁查表2插值</span>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ redV1Line }}</div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ redV2Line }}</div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ redM1Line }}</div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ redM2Line }}</div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ redG1Line }}</div>
            <div class="formula-sub">{{ redF1Line }}</div>
            <div v-if="redRes1?.fOutOfRange" class="formula-warn">
              G₁ 超出表2范围（0~20g），f 取端点值，请核对数据
            </div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ redG2Line }}</div>
            <div class="formula-sub">{{ redF2Line }}</div>
            <div v-if="redRes2?.fOutOfRange" class="formula-warn">
              G₂ 超出表2范围（0~20g），f 取端点值，请核对数据
            </div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ redR1Line }}</div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ redR2Line }}</div>
          </div>
          <div class="formula-item">
            <div class="formula-text">{{ redAvgLine }}</div>
          </div>
          <div class="formula-item result-line">
            <div class="formula-text">
              {{ redErrLine }}
              <t-tag v-if="redStats" :theme="redPrecisionPass ? 'success' : 'danger'" size="small">
                {{ redPrecisionPass ? '≤15% 合格' : '超过15%精密度要求' }}
              </t-tag>
            </div>
          </div>
          <div class="final-result">
            <div class="final-label">还原糖分（保留3位有效数字）</div>
            <div class="final-value">
              {{ redStats ? `${sigDigits(redStats.avg)} g/100g` : '--' }}
            </div>
          </div>
        </div>
      </div>

      <div class="actions">
        <t-button block variant="outline" theme="default" @click="resetAll">重置</t-button>
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

.actions {
  padding: 4px 4px 16px;
}
</style>
