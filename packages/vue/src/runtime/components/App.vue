<script setup lang="ts">
import { useEventListener } from "@vueuse/core";

import { useDomTracker } from "../dom-tracker.ts";
import { useRouteTracker } from "../route-tracker.ts";
import { active, toggleActive } from "../state.ts";
import Inspector from "./Inspector.vue";
import Panel from "./Panel.vue";
import PinLayer from "./PinLayer.vue";
import StalePinTray from "./StalePinTray.vue";
import StatusBar from "./StatusBar.vue";
import "./tokens.css";

useRouteTracker();
useDomTracker();

function onKeyDown(e: KeyboardEvent): void {
  // Match by `code` too — some IMEs / layouts produce different `key` values
  // when Meta is held.
  const isPeriod = e.key === "." || e.code === "Period";
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && isPeriod) {
    e.preventDefault();
    e.stopPropagation();
    toggleActive();
  }
}

// Capture phase so we hear it even if the host app stops propagation.
useEventListener(window, "keydown", onKeyDown, { capture: true });
</script>

<template>
  <!-- DOM order inside `.sn-root` *is* the stack order. Earlier siblings
  render behind later ones. Inspector renders its own selection / hover
  highlight overlays first (in that order: selection below, hover above), so
  they end up at the very bottom of the stack. Pins, tray, status, and panel
  layer on top. The composer is teleported into the trailing
  `.sn-composer-layer` so it sits at the very top, above everything. -->
  <div v-if="active" class="sn-root">
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
  border: 2px solid transparent;
  border-radius: 14px 14px 14px 0;
  background: var(--sn-pin);
  color: var(--sn-on-accent);
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: var(--sn-shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}
.sn-pin.sn-pin-resolved {
  background: var(--sn-pin-resolved);
}
.sn-pin.sn-pin-stale {
  background: var(--sn-pin-stale);
  opacity: 0.6;
}
.sn-pin.sn-pin-draggable {
  cursor: grab;
}
.sn-pin.sn-pin-dragging {
  cursor: grabbing;
  transform: scale(1.2);
}
.sn-pin:hover,
.sn-pin.sn-pin-open {
  transform: scale(1.2);
}
.sn-pin.sn-pin-open {
  border-color: var(--sn-pin-open-border);
}

.sn-badge {
  background: var(--sn-warning-bg);
  color: var(--sn-warning-text);
  padding: 2px 6px;
  border-radius: 9999px;
  font-size: 11px;
}
.sn-badge.sn-badge-danger {
  background: var(--sn-danger);
  color: oklch(99% 0 0);
}
.sn-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sn-form textarea {
  font: inherit;
  background: var(--sn-input-bg);
  color: var(--sn-input-text);
  border: 1px solid var(--sn-input-border);
  border-radius: 6px;
  padding: 8px 10px;
  resize: vertical;
  min-height: 70px;
  width: 100%;
}
.sn-form textarea::placeholder {
  color: var(--sn-input-placeholder);
}
.sn-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.sn-form-actions button {
  font: inherit;
  border: 1px solid var(--sn-border);
  background: var(--sn-surface);
  color: var(--sn-text);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.sn-form-actions button:hover {
  background: var(--sn-surface-raised);
}
.sn-form-actions button.sn-primary {
  background: var(--sn-accent);
  color: var(--sn-on-accent);
  border-color: var(--sn-accent);
}
.sn-form-actions button.sn-primary:hover {
  background: var(--sn-accent-hover);
  border-color: var(--sn-accent-hover);
}
.sn-form-actions button.sn-primary:disabled {
  background: var(--sn-accent-disabled);
  border-color: var(--sn-accent-disabled);
  cursor: not-allowed;
}
</style>
