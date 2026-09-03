<script setup lang="ts">
import { computed } from 'vue'
import type { ValidationRule, CheckResult } from '@/utils/sugarCalc'
import { validateValue } from '@/utils/sugarCalc'

const props = defineProps<{
  label: string
  modelValue: number | null
  placeholder?: string
  suffix?: string
  rule?: ValidationRule
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void
}>()

const textValue = computed<string>({
  get: () => (props.modelValue === null ? '' : String(props.modelValue)),
  set: (val: string) => {
    const trimmed = val.trim()
    if (trimmed === '') {
      emit('update:modelValue', null)
      return
    }
    const num = Number(trimmed)
    emit('update:modelValue', Number.isNaN(num) ? null : num)
  },
})

const check = computed<CheckResult | undefined>(() =>
  props.rule ? validateValue(props.modelValue, props.rule) : undefined,
)

const levelClass = computed(() =>
  check.value ? (check.value.level === 'error' ? 'lab-input--error' : 'lab-input--warn') : '',
)
</script>

<template>
  <div class="lab-input" :class="levelClass">
    <t-input
      v-model="textValue"
      :label="label"
      :placeholder="placeholder ?? '请输入数值'"
      type="number"
      layout="vertical"
      align="right"
      :suffix="suffix"
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
</style>
