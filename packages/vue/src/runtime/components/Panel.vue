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
  background: white;
  border-left: 1px solid #e5e7eb;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  font-size: 13px;
}
.sn-panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
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
  border: 1px solid #e5e7eb;
  background: white;
  color: #374151;
  padding: 4px 8px;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}
.sn-panel-actions button:hover {
  background: #f9fafb;
}
.sn-panel-actions button.sn-active {
  background: #ede9fe;
  border-color: #c4b5fd;
  color: #5b21b6;
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
