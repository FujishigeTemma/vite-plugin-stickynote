<script setup lang="ts">
import { computed, inject } from "vue";
import { ELEMENT_MAP_KEY } from "../cache.ts";
import { isThreadStale } from "../inspector.ts";
import { useStore } from "../store-inject.ts";

const store = useStore();
const elementMap = inject(ELEMENT_MAP_KEY);

// When a pinned component disappears (refactor), surface it in a fixed
// tray so the comment isn't silently lost.
const staleThreads = computed(() => {
  const map = elementMap?.value;
  if (!map) return [];
  return store.visibleThreads.value.filter((t) => isThreadStale(t, map));
});
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
