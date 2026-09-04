<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ValidationRule, CheckResult } from '@/utils/sugarCalc'
import { validateValue } from '@/utils/sugarCalc'

const props = defineProps<{
  label: string
  modelValue: number | null
  placeholder?: string
  suffix?: string
  rule?: ValidationRule
  /** 只读（展示自动生成的数据） */
  readonly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void
}>()

/**
 * 输入框显示的原始文本。
 * 聚焦期间保留原始输入（如 "1."、"1.0"），不做数字回填格式化，
 * 避免 Number() 往返导致小数点/末尾 0 被吞掉；仅失焦时规范化显示。
 */
const text = ref('')
const focused = ref(false)

// 非聚焦状态下，外部值变化（如自动填充、重置）时同步到显示文本
watch(
  () => props.modelValue,
  (v) => {
    if (!focused.value) {
      text.value = v === null ? '' : String(v)
    }
  },
  { immediate: true },
)

// 原始文本变化时解析并向外 emit 数值
watch(text, (val) => {
  const trimmed = val.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
    emit('update:modelValue', null)
    return
  }
  const num = Number(trimmed)
  emit('update:modelValue', Number.isNaN(num) ? null : num)
})

function onFocus() {
  focused.value = true
}

function onBlur() {
  focused.value = false
  // 失焦后按最终数值规范化显示（去掉无意义的 "1." 等）
  const v = props.modelValue
  text.value = v === null ? '' : String(v)
}

const check = computed<CheckResult | undefined>(() =>
  props.rule ? validateValue(props.modelValue, props.rule) : undefined,
)

const levelClass = computed(() =>
  check.value ? (check.value.level === 'error' ? 'lab-input--error' : 'lab-input--warn') : '',
)
</script>

<template>
  <div class="lab-input" :class="[levelClass, { 'lab-input--readonly': readonly }]">
    <t-input
      v-model="text"
      :label="label"
      :placeholder="placeholder ?? '请输入数值'"
      type="number"
      layout="vertical"
      align="right"
      :suffix="suffix"
      :readonly="readonly"
      @focus="onFocus"
      @blur="onBlur"
    />
    <div v-if="check" class="lab-input__tips">{{ check.message }}</div>
  </div>
</template>

<style scoped>
.lab-input__tips {
  padding: 0 16px 8px;
  font-size: 12px;
  line-height: 1.5;
}

.lab-input--error .lab-input__tips {
  color: var(--lab-danger, #d54941);
}

.lab-input--warn .lab-input__tips {
  color: var(--lab-warning, #e37318);
}

/* 校验不通过时输入文字变红，增强提示 */
.lab-input--error :deep(.t-input__control) {
  color: var(--lab-danger, #d54941);
}

/* 只读展示（自动生成的数据） */
.lab-input--readonly :deep(.t-input__control) {
  color: var(--td-text-color-secondary, rgba(0, 0, 0, 0.55));
}
</style>
