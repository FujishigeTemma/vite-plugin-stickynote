<script setup lang="ts">
import {
  closePanel,
  openThread,
  openThreadId,
  panelOpen,
  panelTab,
  showResolved,
} from "../state.ts";
import type { PanelTab } from "../state.ts";
import AgentToken from "./AgentToken.vue";
import AllThreads from "./AllThreads.vue";
import ThreadDetail from "./ThreadDetail.vue";
import ThreadList from "./ThreadList.vue";

function toggleShowResolved(): void {
  showResolved.value = !showResolved.value;
}

function selectTab(t: PanelTab): void {
  // Switching tabs always exits the detail view; the same back action the
  // user could press themselves, made implicit so the tab they clicked is
  // what they actually see.
  if (openThreadId.value) openThread(null);
  panelTab.value = t;
}

const tabs: { id: PanelTab; label: string }[] = [
  { id: "page", label: "this page" },
  { id: "all", label: "all threads" },
  { id: "settings", label: "settings" },
];
</script>

<template>
  <aside v-if="panelOpen" class="sn-panel">
    <header class="sn-panel-header">
      <h2>
        {{
          openThreadId
            ? "Thread"
            : panelTab === "all"
              ? "All Threads"
              : panelTab === "settings"
                ? "Settings"
                : "Threads"
        }}
      </h2>
      <div class="sn-panel-actions">
        <button
          v-if="!openThreadId && panelTab !== 'settings'"
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
      <ThreadList v-else-if="panelTab === 'page'" />
      <AllThreads v-else-if="panelTab === 'all'" />
      <AgentToken v-else-if="panelTab === 'settings'" />
    </div>
    <nav v-if="!openThreadId" class="sn-panel-tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        class="sn-tab"
        :class="{ 'sn-tab-active': panelTab === t.id }"
        @click="selectTab(t.id)"
      >
        {{ t.label }}
      </button>
    </nav>
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
.sn-panel-tabs {
  display: flex;
  border-top: 1px solid var(--sn-border);
  background: var(--sn-surface);
}
.sn-tab {
  flex: 1;
  font: inherit;
  background: transparent;
  border: none;
  color: var(--sn-text-muted);
  padding: 10px 8px;
  cursor: pointer;
  border-top: 2px solid transparent;
  margin-top: -1px;
}
.sn-tab:hover {
  color: var(--sn-text);
}
.sn-tab.sn-tab-active {
  color: var(--sn-text);
  border-top-color: var(--sn-accent);
}
</style>
