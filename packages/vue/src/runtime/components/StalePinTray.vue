<script setup lang="ts">
import { computed } from "vue";

import { useThreadsList } from "../composables.ts";
import { isThreadStale } from "../inspector.ts";
import { elementMap, openThread } from "../state.ts";

const { visible } = useThreadsList();

// Surface pinned components whose anchor has disappeared (refactor / rename)
// so the comment isn't silently lost.
const staleThreads = computed(() =>
  visible.value.filter((t) => isThreadStale(t, elementMap.value)),
);
</script>

<template>
  <div v-if="staleThreads.length > 0" class="sn-stale-tray">
    <button
      v-for="t in staleThreads"
      :key="t.id"
      type="button"
      class="sn-pin sn-pin-stale"
      :title="`stale: ${t.component_path}:${t.component_line}`"
      @click="openThread(t.id)"
    >
      ?
    </button>
  </div>
</template>

<style scoped>
.sn-stale-tray {
  position: fixed;
  top: 80px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: auto;
  max-width: 220px;
}
/* Override the absolute positioning of `.sn-pin` so tray buttons stack. */
.sn-stale-tray .sn-pin {
  position: relative;
  margin: 0;
}
</style>
