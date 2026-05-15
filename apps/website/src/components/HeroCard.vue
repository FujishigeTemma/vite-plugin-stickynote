<script setup lang="ts">
defineProps<{ title: string; subtitle: string }>();
</script>

<template>
  <header class="hero">
    <h1 class="title">{{ title }}</h1>
    <p class="subtitle">{{ subtitle }}</p>
  </header>
</template>

<style scoped>
.hero {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--accent-bg);
}
.title {
  margin: 0 0 8px;
  color: var(--text-h);
}
.subtitle {
  margin: 0;
}
</style>
