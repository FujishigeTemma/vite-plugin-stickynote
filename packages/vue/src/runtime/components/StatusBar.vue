<script setup lang="ts">
import { computed } from "vue";

import { noRouter, options, panelOpen, togglePanel } from "../state.ts";
import HelpButton from "./HelpButton.vue";

const dirtyBadge = computed(() => (options.value?.dirtyBuild ? "local changes" : null));
const shortCommit = computed(() => options.value?.commitHash.slice(0, 7) ?? "");
</script>

<template>
  <div class="sn-statusbar">
    <span
      v-if="noRouter"
      class="sn-badge sn-badge-danger"
      title="vue-router not detected — threads will save under stale routes. Install vue-router on the host app."
    >
      no router
    </span>
    <span v-if="dirtyBadge" class="sn-badge">{{ dirtyBadge }}</span>
    <span class="sn-commit">{{ shortCommit }}</span>
    <HelpButton />
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
  background: var(--sn-surface-glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--sn-border);
  border-radius: 9999px;
  box-shadow: var(--sn-shadow-md);
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
  background: var(--sn-surface-raised);
}
.sn-statusbar button.sn-active {
  background: var(--sn-accent-bg);
  color: var(--sn-accent-text);
}
.sn-commit {
  font-family: ui-monospace, monospace;
  color: var(--sn-text-muted);
  font-size: 11px;
}
</style>
