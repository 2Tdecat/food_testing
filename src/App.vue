<script setup lang="ts">
</script>

<template>
  <div class="app-shell">
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background-color: var(--td-bg-color-page, #f3f3f3);
}
</style>
