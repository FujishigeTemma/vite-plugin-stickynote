<script setup lang="ts">
import { useMutation } from "@tanstack/vue-query";
import { useDraggable, useEventListener, useKeyModifier } from "@vueuse/core";
import { computed, onScopeDispose, reactive, ref, shallowRef, useTemplateRef, watch } from "vue";

import { clearAnchor, stampAnchor } from "../anchor-binding.ts";
import {
  ancestorsWithInspector,
  buildGithubUrl,
  clamp,
  componentKey,
  defaultDepthFor,
  elementDisplayName,
  findOccurrenceIndex,
  getInspectorData,
  nearestComponentRoot,
  parseInspector,
  sameComponent,
} from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { isJumpModifier } from "../platform.ts";
import { queryClient } from "../query-client.ts";
import { domVersion, openThreadId, options, toggleActive } from "../state.ts";
import type { Component } from "../types.ts";
import HoverHighlight, { type HoverInfo } from "./HoverHighlight.vue";
import SelectionLayer from "./SelectionLayer.vue";

const HOVER_ANCHOR = "--sn-hover";

const createThread = useMutation(serverMutations.threads.create(), queryClient);

// Pre-persistence form of a component pick: server assigns `id` and
// `display_order` at insert time.
type SelectedComponent = Omit<Component, "id" | "display_order">;

const composer = reactive<{
  visible: boolean;
  body: string;
  saving: boolean;
  rect: { left: number; top: number; width: number; height: number } | null;
  pinX: number;
  pinY: number;
  // components[0] is the anchor (pin coords are relative to it) and cannot be
  // removed; later entries are shift+click-added extras and can be toggled
  // off.
  components: SelectedComponent[];
}>({
  visible: false,
  body: "",
  saving: false,
  rect: null,
  pinX: 0,
  pinY: 0,
  components: [],
});

const composerEl = useTemplateRef<HTMLElement>("composerEl");
const composerHandleEl = useTemplateRef<HTMLElement>("composerHandleEl");

const { x: dialogX, y: dialogY } = useDraggable(composerEl, {
  handle: composerHandleEl,
  initialValue: { x: 0, y: 0 },
  preventDefault: true,
});

// `useKeyModifier` reads `evt.getModifierState(...)` on each tracked event
// (keydown/keyup/mousedown/mouseup), so it stays accurate across Cmd+Tab
// blur and won't get stuck in the held state.
const metaMod = useKeyModifier("Meta");
const ctrlMod = useKeyModifier("Control");

// Hover state as reactive primitives. Everything downstream (`pick`,
// `hoverInfo`, the CSS anchor stamp) is a `computed` / `watch` derivative —
// no imperative renderHighlight() to keep in sync with multiple call sites.
const lastEvent = shallowRef<MouseEvent | null>(null);
const lastInnermost = shallowRef<Element | null>(null);
// Absolute index into ancestorsWithInspector(lastEvent.target), innermost-first.
// Default = the owning component's root (matches pre-Alt+arrow behavior); Alt+
// ArrowDown drills below (into divs), Alt+ArrowUp climbs above.
const depth = ref(0);

function eventInOverlay(e: Event): boolean {
  const t = e.target;
  return t instanceof Element && !!t.closest("[data-stickynote-ignore]");
}

type Pick = {
  el: HTMLElement;
  data: string;
  path: string;
  line: number;
};

// `void domVersion.value` subscribes to host-DOM mutations so the pick auto-
// refreshes after HMR / v-for re-renders — same pattern as useStaleThreads
// in composables.ts. v_for_index is intentionally NOT computed here:
// findOccurrenceIndex is a document-wide querySelectorAll, and the hover path
// fires on every mouseover. Pay that cost only on click.
const pick = computed<Pick | null>(() => {
  void domVersion.value;
  const ev = lastEvent.value;
  if (!ev || !(ev.target instanceof Element)) return null;
  const chain = ancestorsWithInspector(ev.target);
  if (chain.length === 0) return null;
  const idx = Math.min(Math.max(depth.value, 0), chain.length - 1);
  const el = chain[idx];
  if (!(el instanceof HTMLElement)) return null;
  const data = getInspectorData(el);
  const info = parseInspector(data);
  if (!info || !data) return null;
  return { el, data, path: info.path, line: info.line };
});

function jumpModifierActive(e?: MouseEvent | KeyboardEvent): boolean {
  return isJumpModifier({
    metaKey: !!metaMod.value || !!e?.metaKey,
    ctrlKey: !!ctrlMod.value || !!e?.ctrlKey,
  });
}

const hoverInfo = computed<HoverInfo | null>(() => {
  const ev = lastEvent.value;
  if (!ev || !options.value || eventInOverlay(ev)) return null;
  const p = pick.value;
  if (!p) return null;
  const githubUrl = buildGithubUrl(
    options.value.githubRepo,
    options.value.commitHash,
    p.path,
    p.line,
  );
  if (jumpModifierActive(ev) && githubUrl) {
    return {
      mode: "jump",
      source: `${p.path}:${p.line}`,
      commit: options.value.commitHash,
    };
  }
  return {
    mode: "info",
    name: elementDisplayName(p.el),
    source: `${p.path}:${p.line}`,
  };
});

// Stamp / clear the CSS anchor whenever the picked element changes. The
// stamp itself is a side effect on the host DOM, so it stays a watch — the
// computed describes WHICH element, this watch keeps the host DOM in sync.
let stampedEl: HTMLElement | null = null;
watch(
  () => (hoverInfo.value ? (pick.value?.el ?? null) : null),
  (el) => {
    if (el === stampedEl) return;
    clearAnchor(stampedEl, HOVER_ANCHOR);
    if (el) stampAnchor(el, HOVER_ANCHOR);
    stampedEl = el;
  },
);

function onMouseOver(e: MouseEvent): void {
  lastEvent.value = e;
  const target = e.target instanceof Element ? e.target : null;
  const newInnermost = target ? nearestComponentRoot(target) : null;
  if (newInnermost !== lastInnermost.value) {
    lastInnermost.value = newInnermost;
    const chain = target ? ancestorsWithInspector(target) : [];
    depth.value = target ? defaultDepthFor(target, chain) : 0;
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    if (composer.visible) closeComposer();
    else toggleActive();
    return;
  }
  // Alt+ArrowUp/Down: step depth. Require Alt as the sole modifier so we
  // don't collide with Cmd-arrow word navigation or browser Alt+Shift combos.
  if (!e.altKey || e.shiftKey || e.metaKey || e.ctrlKey) return;
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  const ev = lastEvent.value;
  if (!ev || !(ev.target instanceof Element)) return;
  const chain = ancestorsWithInspector(ev.target);
  if (chain.length === 0) return;
  // Capture-phase listener consumes the key before inputs see it, so a
  // focused textarea doesn't move its caret while inspecting.
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "ArrowUp") depth.value = Math.min(depth.value + 1, chain.length - 1);
  else depth.value = Math.max(depth.value - 1, 0);
}

function onClickCapture(e: MouseEvent): void {
  if (eventInOverlay(e)) return;
  // capture-phase preventDefault also suppresses host <a> navigation, so the
  // jump path's window.open is the only navigation that runs.
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  // Pin the highlighted element, not e.target — depth may have stepped away.
  const p = pick.value;
  if (!p || !options.value) return;

  // Cmd/Ctrl+click: jump to source on GitHub. The hover label can't host a
  // clickable link (it follows the cursor), so the affordance lives on the
  // highlighted rect itself via this modifier.
  if (jumpModifierActive(e)) {
    const url = buildGithubUrl(options.value.githubRepo, options.value.commitHash, p.path, p.line);
    if (url) window.open(url, "_blank", "noopener");
    return;
  }

  const sel: SelectedComponent = {
    path: p.path,
    line: p.line,
    v_for_index: findOccurrenceIndex(p.el, p.data),
    name: elementDisplayName(p.el),
  };

  // Shift+click with composer open: Finder-style multi-select. Toggle the
  // component in/out. The first element is the pin anchor and cannot be
  // removed by shift+clicking it again.
  if (e.shiftKey && composer.visible && composer.components.length > 0) {
    const primary = composer.components[0];
    if (primary && sameComponent(primary, sel)) return;
    const i = composer.components.findIndex((c, idx) => idx > 0 && sameComponent(c, sel));
    if (i >= 0) composer.components.splice(i, 1);
    else composer.components.push(sel);
    return;
  }

  // Plain click (or shift+click with no composer): open a new composer.
  // Read the rect once here to compute click→ratio at submit; the element's
  // live position afterwards is irrelevant — we want the ratio at the moment
  // the user picked.
  const r = p.el.getBoundingClientRect();
  composer.rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  composer.pinX = e.clientX;
  composer.pinY = e.clientY;
  dialogX.value = Math.min(window.innerWidth - 340, Math.max(0, e.clientX + 12));
  dialogY.value = Math.min(window.innerHeight - 220, Math.max(0, e.clientY + 12));
  composer.components = [sel];
  composer.body = "";
  composer.visible = true;
}

function removeAdditional(i: number): void {
  // i + 1 because index 0 is the pin anchor and cannot be removed.
  composer.components.splice(i + 1, 1);
}

function closeComposer(): void {
  composer.visible = false;
  composer.components = [];
  composer.rect = null;
  composer.body = "";
  composer.saving = false;
}

function submitComposer(): void {
  const primary = composer.components[0];
  if (!primary || !composer.rect || !options.value) return;
  if (!composer.body.trim()) return;
  composer.saving = true;
  const x_ratio = (composer.pinX - composer.rect.left) / composer.rect.width;
  const y_ratio = (composer.pinY - composer.rect.top) / composer.rect.height;
  createThread.mutate(
    {
      commit_hash: options.value.commitHash,
      dirty_build: options.value.dirtyBuild,
      x_ratio: clamp(x_ratio),
      y_ratio: clamp(y_ratio),
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      components: composer.components.map((c) => ({
        path: c.path,
        line: c.line,
        v_for_index: c.v_for_index,
        name: c.name,
      })),
      body: composer.body,
    },
    {
      onSettled: () => (composer.saving = false),
      onSuccess: () => closeComposer(),
    },
  );
}

const composerStyle = computed(() => ({
  left: Math.min(window.innerWidth - 340, Math.max(0, dialogX.value)) + "px",
  top: Math.min(window.innerHeight - 220, Math.max(0, dialogY.value)) + "px",
}));

const primaryComponent = computed(() => composer.components[0] ?? null);

const selectionPicks = computed(() =>
  composer.visible && composer.components.length > 0 ? composer.components : [],
);

useEventListener(document, "mouseover", onMouseOver, { capture: true });
useEventListener(document, "click", onClickCapture, { capture: true });
// Capture phase so a focused <input>/<textarea> doesn't swallow Alt+ArrowUp/Down
// (caret move) before we consume it.
useEventListener(window, "keydown", onKey, { capture: true });

onScopeDispose(() => {
  clearAnchor(stampedEl, HOVER_ANCHOR);
  stampedEl = null;
});
</script>

<template>
  <!-- DOM order inside .sn-root is the stack order. SelectionLayer first
  (below) then HoverHighlight (above), so the live hover sits on top of the
  persistent selection rectangles. -->
  <SelectionLayer :composer-picks="selectionPicks" />
  <HoverHighlight :info="hoverInfo" />

  <!-- Teleport to the trailing `.sn-composer-layer` inside `.sn-root` so the
  composer ends up as the last DOM child of the plugin's stacking context.
  `defer` lets Vue resolve the target after App.vue has rendered it on the
  same tick. -->
  <Teleport to=".sn-composer-layer" defer>
    <div
      v-if="composer.visible && composer.rect && primaryComponent"
      ref="composerEl"
      class="sn-composer-overlay"
      :style="composerStyle"
      @click.stop
    >
      <div ref="composerHandleEl" class="sn-composer-target">
        <div class="sn-composer-primary">
          ★ {{ primaryComponent.name }} · {{ primaryComponent.path }}:{{
            primaryComponent.line
          }}
          (#{{ primaryComponent.v_for_index }})
        </div>
        <div v-if="composer.components.length > 1" class="sn-composer-additional">
          <div
            v-for="(c, i) in composer.components.slice(1)"
            :key="componentKey(c)"
            class="sn-chip"
          >
            <span class="sn-chip-text"
              >{{ c.name }} · {{ c.path }}:{{ c.line }} (#{{ c.v_for_index }})</span
            >
            <button
              type="button"
              class="sn-chip-remove"
              aria-label="remove"
              @click="removeAdditional(i)"
            >
              ×
            </button>
          </div>
        </div>
        <div class="sn-composer-hint">shift+click to link more components</div>
      </div>
      <div class="sn-form">
        <textarea v-model="composer.body" placeholder="Leave a comment…" autofocus />
        <div class="sn-form-actions">
          <button type="button" @click="closeComposer">cancel</button>
          <button
            type="button"
            class="sn-primary"
            :disabled="composer.saving || !composer.body.trim()"
            @click="submitComposer"
          >
            {{ composer.saving ? "Saving…" : "Pin" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sn-composer-overlay {
  position: fixed;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 12px;
  width: 320px;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sn-composer-target {
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: move;
  user-select: none;
  touch-action: none;
}
.sn-composer-primary {
  font-size: 11px;
  color: #374151;
  font-family: ui-monospace, monospace;
}
.sn-composer-additional {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sn-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #ede9fe;
  border: 1px solid #c4b5fd;
  border-radius: 4px;
  padding: 2px 4px 2px 6px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: #4c1d95;
}
.sn-chip-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sn-chip-remove {
  background: transparent;
  border: 0;
  color: #6d28d9;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 4px;
}
.sn-composer-hint {
  font-size: 10px;
  color: #9ca3af;
}
</style>
