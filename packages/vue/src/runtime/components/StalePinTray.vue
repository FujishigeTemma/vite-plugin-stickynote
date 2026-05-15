<script setup lang="ts">
import { computed } from "vue";
import { findElementForThread } from "../inspector.ts";
import { useStore } from "../store-inject.ts";

const store = useStore();

// PLAN 7.1: when a pinned component disappears (refactor), surface it in a
// fixed tray so the comment isn't silently lost.
const staleThreads = computed(() =>
  store.threadsForCurrentRoute.value.filter((t) => {
    if (t.status === "resolved" && !store.showResolved.value) return false;
    if (t.component_path == null || t.component_line == null) return false;
    return findElementForThread(t.component_path, t.component_line, t.component_index) == null;
  }),
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
      @click="store.openThread(t.id)"
    >
      ?
    </button>
  </div>
</template>
