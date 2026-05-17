<script setup lang="ts">
import { useStaleThreads, useThreadsList } from "../composables.ts";
import { openThread } from "../state.ts";

const { visible } = useThreadsList();
const { stale: staleThreads } = useStaleThreads(visible);
</script>

<template>
  <div v-if="staleThreads.length > 0" class="sn-stale-tray">
    <button
      v-for="t in staleThreads"
      :key="t.id"
      type="button"
      class="sn-pin sn-pin-stale"
      :title="`stale: ${t.components[0]?.path}:${t.components[0]?.line}`"
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
