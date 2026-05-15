<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, watch } from "vue";
import { createApi } from "../api.ts";
import { createOverlayCache, ELEMENT_MAP_KEY, TICK_KEY } from "../cache.ts";
import { createStore } from "../state.ts";
import { STORE_KEY } from "../store-inject.ts";
import type { OverlayOptions } from "../../options.ts";
import Inspector from "./Inspector.vue";
import Panel from "./Panel.vue";
import PinLayer from "./PinLayer.vue";
import StalePinTray from "./StalePinTray.vue";
import StatusBar from "./StatusBar.vue";

const props = defineProps<{ options: OverlayOptions }>();

const api = createApi(props.options.apiUrl, () => props.options.devBearer);
const store = createStore(props.options, api);
const cache = createOverlayCache();

provide(STORE_KEY, store);
provide(TICK_KEY, cache.tick);
provide(ELEMENT_MAP_KEY, cache.elementMap);

function onKeyDown(e: KeyboardEvent): void {
  // Match by `code` too — some IMEs / layouts produce different `key` values
  // when Meta is held.
  const isPeriod = e.key === "." || e.code === "Period";
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && isPeriod) {
    e.preventDefault();
    e.stopPropagation();
    store.toggleActive();
  }
}

// Poll for new threads while the overlay is active. 5 s is a comfortable
// upper bound for "near-realtime" without burning CPU.
const POLL_MS = 5000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

watch(
  () => store.active.value,
  (a) => {
    if (a) {
      cache.start();
      pollTimer = setInterval(() => {
        void store.refreshThreads();
      }, POLL_MS);
    } else {
      cache.stop();
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  },
);

onMounted(() => {
  // Capture phase so we hear it even if the host app stops propagation.
  window.addEventListener("keydown", onKeyDown, true);
  // Browser-console handle for debugging.
  (window as unknown as { __STICKYNOTE__?: unknown }).__STICKYNOTE__ = store;
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown, true);
  cache.stop();
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div v-if="store.active.value" class="sn-root">
    <Inspector v-if="store.mode.value === 'inspecting'" />
    <PinLayer />
    <StalePinTray />
    <StatusBar />
    <Panel />
  </div>
</template>
