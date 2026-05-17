<script setup lang="ts">
import { computed } from "vue";

import { options, panelOpen, togglePanel } from "../state.ts";

const dirtyBadge = computed(() => (options.value?.dirtyBuild ? "local changes" : null));
const shortCommit = computed(() => options.value?.commitHash.slice(0, 7) ?? "");
</script>

<template>
  <div class="sn-statusbar">
    <span v-if="dirtyBadge" class="sn-badge">{{ dirtyBadge }}</span>
    <span class="sn-commit">{{ shortCommit }}</span>
    <button
      type="button"
      :class="{ 'sn-active': panelOpen }"
      title="Toggle panel"
      @click="togglePanel"
    >
      threads
    </button>
  </div>
</template>

<style scoped>
.sn-statusbar {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  align-items: center;
  line-height: 1;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 9999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
}
.sn-statusbar button {
  font: inherit;
  color: inherit;
  border: none;
  background: transparent;
  padding: 2px 8px;
  border-radius: 9999px;
  cursor: pointer;
}
.sn-statusbar button:hover {
  background: #f3f4f6;
}
.sn-statusbar button.sn-active {
  background: #ede9fe;
  color: #5b21b6;
}
.sn-commit {
  font-family: ui-monospace, monospace;
  color: #6b7280;
  font-size: 11px;
}
</style>
