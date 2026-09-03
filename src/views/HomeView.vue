<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { searchTools } from '@/data/tools'

const router = useRouter()
const keyword = ref('')

const filteredTools = computed(() => searchTools(keyword.value))

function openTool(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="page">
    <div class="home-header">
      <div class="home-title">实验室工具</div>
      <div class="home-subtitle">食品检测实验计算工具库</div>
    </div>

    <div class="home-search">
      <t-search
        v-model="keyword"
        placeholder="搜索功能，如：糖分、蔗糖、还原糖"
        :center="false"
      />
    </div>

    <div class="tool-section">
      <div class="section-title">实验计算</div>
      <t-cell-group bordered>
        <t-cell
          v-for="tool in filteredTools"
          :key="tool.id"
          class="tool-cell"
          hover
          @click="openTool(tool.path)"
        >
          <template #leftIcon>
            <div class="tool-icon">
              <t-icon :name="tool.icon" size="24px" />
            </div>
          </template>
          <template #title>
            <div class="tool-name">{{ tool.name }}</div>
          </template>
          <template #description>
            <div class="tool-desc">{{ tool.description }}</div>
          </template>
          <template #note>
            <t-icon name="chevron-right" size="18px" color="#c0c8d3" />
          </template>
        </t-cell>
      </t-cell-group>

      <t-empty
        v-if="filteredTools.length === 0"
        description="未找到相关功能"
        class="tool-empty"
      />
    </div>
  </div>
</template>

<style scoped>
.home-header {
  padding: 28px 16px 12px;
  background: linear-gradient(135deg, #0052d9 0%, #2b6de8 100%);
  color: #fff;
}

.home-title {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 1px;
}

.home-subtitle {
  margin-top: 4px;
  font-size: 13px;
  opacity: 0.85;
}

.home-search {
  padding: 12px;
  background: linear-gradient(135deg, #2b6de8 0%, #2b6de8 70%, rgba(43, 109, 232, 0) 100%);
}

.home-search :deep(.t-search) {
  border-radius: 8px;
}

.tool-section {
  padding: 4px 12px 0;
}

.section-title {
  padding: 12px 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary, rgba(0, 0, 0, 0.9));
}

.tool-cell {
  padding: 14px 16px;
}

.tool-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 82, 217, 0.08);
  color: var(--lab-primary, #0052d9);
  margin-right: 4px;
}

.tool-name {
  font-size: 16px;
  font-weight: 500;
}

.tool-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--td-text-color-placeholder, rgba(0, 0, 0, 0.4));
}

.tool-empty {
  padding: 32px 0;
}
</style>
