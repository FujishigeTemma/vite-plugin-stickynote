<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);
</script>

<template>
  <button class="counter" type="button" @click="count++">Count is {{ count }}</button>
</template>

<style scoped>
.counter {
  align-self: flex-start;
  padding: 10px 18px;
  font-size: 16px;
  border-radius: 8px;
  border: 1px solid var(--accent-border);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
}
.counter:hover {
  background: var(--accent-bg);
}
</style>
