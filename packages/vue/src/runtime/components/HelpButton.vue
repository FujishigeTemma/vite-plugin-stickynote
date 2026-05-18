<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { ref } from "vue";

const open = ref(false);

const shortcuts: ReadonlyArray<{ keys: ReadonlyArray<string>; action: string }> = [
  { keys: ["Cmd/Ctrl", "."], action: "Toggle plugin on/off" },
  { keys: ["Esc"], action: "Close composer / deactivate plugin" },
  { keys: ["Alt", "↑"], action: "Step DOM depth up (parent)" },
  { keys: ["Alt", "↓"], action: "Step DOM depth down (child)" },
  { keys: ["Cmd/Ctrl", "Click"], action: "Jump to source on GitHub" },
  { keys: ["Shift", "Click"], action: "Multi-select components" },
  { keys: ["Cmd/Ctrl", "Enter"], action: "Submit comment" },
];

// Intercept Escape before Inspector's capture-phase handler so closing the
// modal doesn't also deactivate the plugin.
useEventListener(
  window,
  "keydown",
  (e: KeyboardEvent) => {
    if (!open.value) return;
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open.value = false;
  },
  { capture: true },
);
</script>

<template>
  <button
    type="button"
    class="sn-help-btn"
    :class="{ 'sn-active': open }"
    title="Keyboard shortcuts"
    @click="open = !open"
  >
    ?
  </button>
  <Teleport to=".sn-composer-layer">
    <div v-if="open" class="sn-help-backdrop" @click.self="open = false">
      <div class="sn-help-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div class="sn-help-header">
          <h2>Keyboard shortcuts</h2>
          <button type="button" class="sn-help-close" aria-label="Close" @click="open = false">
            ×
          </button>
        </div>
        <dl class="sn-help-list">
          <template v-for="s in shortcuts" :key="s.action">
            <dt>
              <template v-for="(k, i) in s.keys" :key="k">
                <span v-if="i > 0" class="sn-help-plus">+</span>
                <kbd>{{ k }}</kbd>
              </template>
            </dt>
            <dd>{{ s.action }}</dd>
          </template>
        </dl>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sn-help-btn {
  font: inherit;
  color: var(--sn-text-muted);
  border: none;
  background: transparent;
  width: 20px;
  height: 20px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border-radius: 9999px;
  cursor: pointer;
}
.sn-help-btn:hover {
  background: var(--sn-surface-raised);
}
.sn-help-btn.sn-active {
  background: var(--sn-accent-bg);
  color: var(--sn-accent-text);
}

.sn-help-backdrop {
  position: fixed;
  inset: 0;
  background: var(--sn-scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
.sn-help-modal {
  background: var(--sn-surface);
  border: 1px solid var(--sn-border);
  border-radius: 10px;
  box-shadow: var(--sn-shadow-lg);
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 16px 18px;
}
.sn-help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.sn-help-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--sn-text);
}
.sn-help-close {
  font: inherit;
  border: none;
  background: transparent;
  color: var(--sn-text-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 6px;
}
.sn-help-close:hover {
  background: var(--sn-surface-raised);
  color: var(--sn-text);
}
.sn-help-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 12px;
  margin: 0;
}
.sn-help-list dt {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.sn-help-list dd {
  margin: 0;
  display: flex;
  align-items: center;
  color: var(--sn-text);
}
.sn-help-list kbd {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: var(--sn-text);
  background: var(--sn-surface-raised);
  border: 1px solid var(--sn-border-strong);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 1px 6px;
  line-height: 1.4;
}
.sn-help-plus {
  color: var(--sn-text-subtle);
  font-size: 11px;
}
</style>
