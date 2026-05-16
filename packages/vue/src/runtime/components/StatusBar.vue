<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "../store-inject.ts";

const store = useStore();

const dirtyBadge = computed(() => (store.options.dirtyBuild ? "local changes" : null));
const shortCommit = computed(() => store.options.commitHash.slice(0, 7));

function togglePanel(): void {
  store.panelOpen.value = !store.panelOpen.value;
}
</script>

<template>
  <div class="sn-statusbar">
    <span class="sn-title">stickynote</span>
    <span v-if="dirtyBadge" class="sn-badge">{{ dirtyBadge }}</span>
    <span class="sn-commit">{{ shortCommit }}</span>
    <button
      type="button"
      :class="{ 'sn-active': store.panelOpen.value }"
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
.sn-title {
  font-weight: 600;
}
.sn-commit {
  font-family: ui-monospace, monospace;
  color: #6b7280;
  font-size: 11px;
}
</style>
