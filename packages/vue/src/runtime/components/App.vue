<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, watch } from "vue";
import { ELEMENT_MAP_KEY, TICK_KEY, type OverlayCache } from "../cache.ts";
import { setupRouteTracking, type StickynoteStore } from "../state.ts";
import { STORE_KEY } from "../store-inject.ts";
import Inspector from "./Inspector.vue";
import Panel from "./Panel.vue";
import PinLayer from "./PinLayer.vue";
import StalePinTray from "./StalePinTray.vue";
import StatusBar from "./StatusBar.vue";

const props = defineProps<{
  store: StickynoteStore;
  cache: OverlayCache;
}>();

provide(STORE_KEY, props.store);
provide(TICK_KEY, props.cache.tick);
provide(ELEMENT_MAP_KEY, props.cache.elementMap);

function onKeyDown(e: KeyboardEvent): void {
  // Match by `code` too — some IMEs / layouts produce different `key` values
  // when Meta is held.
  const isPeriod = e.key === "." || e.code === "Period";
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && isPeriod) {
    e.preventDefault();
    e.stopPropagation();
    props.store.toggleActive();
  }
}

// Poll for new threads while the overlay is active. 5 s is a comfortable
// upper bound for "near-realtime" without burning CPU.
const POLL_MS = 5000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let stopRouteTracking: () => void = () => {};

watch(
  () => props.store.active.value,
  (a) => {
    if (a) {
      props.cache.start();
      pollTimer = setInterval(() => {
        void props.store.refreshThreads();
      }, POLL_MS);
    } else {
      props.cache.stop();
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
  // By App.vue's onMounted the host app has rendered in the overwhelmingly
  // common case, so `findHostRouter`'s DOM probe finds something.
  stopRouteTracking = setupRouteTracking(props.store);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown, true);
  if (pollTimer) clearInterval(pollTimer);
  stopRouteTracking();
  props.cache.stop();
});
</script>

<template>
  <!-- DOM order inside `.sn-root` *is* the stack order. Earlier siblings
  render behind later ones. Inspector prepends its imperative hover /
  selection overlays into this root, so they sit at the very bottom; the
  composer is teleported into the trailing `.sn-composer-layer` so it sits at
  the very top, above pins, the panel, and the highlights. -->
  <div v-if="props.store.active.value" class="sn-root">
    <Inspector />
    <PinLayer />
    <StalePinTray />
    <StatusBar />
    <Panel />
    <div class="sn-composer-layer" />
  </div>
</template>

<style scoped>
/* The single "escape the host page" stacking context for the entire plugin
UI. All overlays (highlights, pins, panel, composer, status bar) live inside
this root and rely on DOM order — not z-index — to settle their relative
stacking. The big z-index value here only exists to clear arbitrary host-page
z-indices; do not add more global z-indices elsewhere in the plugin. */
.sn-root {
  position: fixed;
  inset: 0;
  isolation: isolate;
  pointer-events: none;
  z-index: 2147483000;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    sans-serif;
  color: #111827;
  font-size: 13px;
  line-height: 1.4;
}
.sn-composer-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>

<!-- Shared widgets that render across multiple SFCs (.sn-pin in PinLayer +
StalePinTray; .sn-badge / .sn-form* in several panels). Kept unscoped so all
sites pick them up without per-component `:deep()` wrappers. The `sn-` prefix
prevents collision with host-page CSS. -->
<style>
.sn-root,
.sn-root *,
.sn-root *::before,
.sn-root *::after {
  box-sizing: border-box;
}

.sn-pin {
  position: fixed;
  width: 28px;
  height: 28px;
  margin-left: -14px;
  margin-top: -28px;
  border: none;
  border-radius: 14px 14px 14px 0;
  background: #f59e0b;
  color: white;
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}
.sn-pin.sn-pin-resolved {
  background: #10b981;
}
.sn-pin.sn-pin-stale {
  background: #6b7280;
  opacity: 0.6;
}
.sn-pin.sn-pin-draggable {
  cursor: grab;
}
.sn-pin.sn-pin-dragging {
  cursor: grabbing;
  transform: scale(1.1);
}
.sn-pin:hover {
  transform: scale(1.1);
}

.sn-badge {
  background: #fef3c7;
  color: #92400e;
  padding: 2px 6px;
  border-radius: 9999px;
  font-size: 11px;
}
.sn-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sn-form textarea {
  font: inherit;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
  resize: vertical;
  min-height: 70px;
  width: 100%;
}
.sn-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.sn-form-actions button {
  font: inherit;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.sn-form-actions button.sn-primary {
  background: #8b5cf6;
  color: white;
  border-color: #8b5cf6;
}
.sn-form-actions button.sn-primary:disabled {
  background: #c4b5fd;
  border-color: #c4b5fd;
  cursor: not-allowed;
}
</style>
