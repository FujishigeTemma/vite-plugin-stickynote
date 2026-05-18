<script setup lang="ts">
import { closePanel, openThreadId, panelOpen, showResolved } from "../state.ts";
import ThreadDetail from "./ThreadDetail.vue";
import ThreadList from "./ThreadList.vue";

function toggleShowResolved(): void {
  showResolved.value = !showResolved.value;
}
</script>

<template>
  <aside v-if="panelOpen" class="sn-panel">
    <header class="sn-panel-header">
      <h2>{{ openThreadId ? "Thread" : "Threads" }}</h2>
      <div class="sn-panel-actions">
        <button
          v-if="!openThreadId"
          type="button"
          :class="{ 'sn-active': showResolved }"
          @click="toggleShowResolved"
        >
          show resolved
        </button>
        <button type="button" @click="closePanel">close</button>
      </div>
    </header>
    <div class="sn-panel-body">
      <ThreadDetail v-if="openThreadId" />
      <ThreadList v-else />
    </div>
  </aside>
</template>

<style scoped>
.sn-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  max-width: 90vw;
  height: 100vh;
  background: var(--sn-surface);
  border-left: 1px solid var(--sn-border);
  box-shadow: var(--sn-shadow-lg);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  font-size: 13px;
}
.sn-panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--sn-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sn-panel-header h2 {
  font-size: 14px;
  margin: 0;
}
.sn-panel-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.sn-panel-actions button {
  border: 1px solid var(--sn-border);
  background: var(--sn-surface);
  color: var(--sn-text);
  padding: 4px 8px;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}
.sn-panel-actions button:hover {
  background: var(--sn-surface-raised);
}
.sn-panel-actions button.sn-active {
  background: var(--sn-accent-bg);
  border-color: var(--sn-accent-border);
  color: var(--sn-accent-text);
}
.sn-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
