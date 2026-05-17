<script setup lang="ts">
import { useMutation } from "@tanstack/vue-query";
import { useDraggable, useEventListener, useKeyModifier } from "@vueuse/core";
import { computed, onScopeDispose, reactive, ref, useTemplateRef, watch } from "vue";

import { clearAnchor, stampAnchor } from "../anchor-binding.ts";
import {
  buildGithubUrl,
  clamp,
  componentKey,
  findInspectorDescendant,
  findOccurrenceIndex,
  parseInspector,
  sameComponent,
} from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { isJumpModifier } from "../platform.ts";
import { queryClient } from "../query-client.ts";
import { openThreadId, options, toggleActive } from "../state.ts";
import type { Component } from "../types.ts";
import {
  ancestorChain,
  findInstance,
  instanceInspector,
  instanceName,
  type Instance,
} from "../vue-instance.ts";
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

const hoverInfo = ref<HoverInfo | null>(null);

let hoverEl: HTMLElement | null = null;
function setHoverAnchor(el: HTMLElement | null): void {
  if (el === hoverEl) return;
  clearAnchor(hoverEl, HOVER_ANCHOR);
  if (el) stampAnchor(el, HOVER_ANCHOR);
  hoverEl = el;
}

function clearHover(): void {
  setHoverAnchor(null);
  hoverInfo.value = null;
}

const composerEl = useTemplateRef<HTMLElement>("composerEl");
const composerHandleEl = useTemplateRef<HTMLElement>("composerHandleEl");
const composerFormEl = useTemplateRef<HTMLFormElement>("composerFormEl");

const { x: dialogX, y: dialogY } = useDraggable(composerEl, {
  handle: composerHandleEl,
  initialValue: { x: 0, y: 0 },
  preventDefault: true,
});

// `useKeyModifier` reads `evt.getModifierState(...)` on each tracked event
// (keydown/keyup/mousedown/mouseup), so it stays accurate across Cmd+Tab
// blur and won't get stuck in the held state.
const altMod = useKeyModifier("Alt");
const metaMod = useKeyModifier("Meta");
const ctrlMod = useKeyModifier("Control");

let lastEvent: MouseEvent | null = null;

function eventInOverlay(e: Event): boolean {
  const t = e.target;
  return t instanceof Element && !!t.closest("[data-stickynote-ignore]");
}

// With Alt held, step one level outward in the component chain so wrappers
// stay reachable when their inner element fills the rect.
function pickInstance(e: MouseEvent): Instance | null {
  const target = e.target;
  if (!(target instanceof Element)) return null;
  const owner = findInstance(target);
  if (!owner) return null;
  if (!(altMod.value || e.altKey)) return owner;
  const chain = ancestorChain(owner);
  return chain[1] ?? owner;
}

function jumpModifierActive(e?: MouseEvent | KeyboardEvent): boolean {
  return isJumpModifier({
    metaKey: !!metaMod.value || !!e?.metaKey,
    ctrlKey: !!ctrlMod.value || !!e?.ctrlKey,
  });
}

function renderHighlight(): void {
  if (!lastEvent || !options.value || eventInOverlay(lastEvent)) {
    clearHover();
    return;
  }
  const inst = pickInstance(lastEvent);
  const el = inst ? ((inst.subTree?.el ?? inst.vnode?.el) as Element | null) : null;
  // Fragment-rooted components have no single anchor element. Drop the
  // highlight rather than guess; click-to-pin still works because that path
  // uses findOccurrenceIndex against the element the user actually clicked.
  if (!inst || !el || el.nodeType !== 1) {
    clearHover();
    return;
  }
  setHoverAnchor(el as HTMLElement);

  const data = instanceInspector(inst);
  const info = data ? parseInspector(data) : null;
  const githubUrl =
    info &&
    buildGithubUrl(options.value.githubRepo, options.value.commitHash, info.path, info.line);
  if (jumpModifierActive(lastEvent) && info && githubUrl) {
    hoverInfo.value = {
      mode: "jump",
      source: `${info.path}:${info.line}`,
      commit: options.value.commitHash,
    };
    return;
  }
  hoverInfo.value = {
    mode: "info",
    name: instanceName(inst),
    source: info ? `${info.path}:${info.line}` : null,
  };
}

function onMouseOver(e: MouseEvent): void {
  lastEvent = e;
  renderHighlight();
}

// Modifier-key changes re-pick the instance (Alt) and re-evaluate label
// mode (Cmd/Ctrl) without a new mouse event.
watch([altMod, metaMod, ctrlMod], () => renderHighlight());

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    if (composer.visible) closeComposer();
    else toggleActive();
  }
}

function onClickCapture(e: MouseEvent): void {
  if (eventInOverlay(e)) return;
  // capture-phase preventDefault also suppresses host <a> navigation, so the
  // jump path's window.open is the only navigation that runs.
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  const inst = pickInstance(e);
  if (!inst) return;
  const data = instanceInspector(inst);
  const info = data ? parseInspector(data) : null;
  if (!info || !data || !options.value) return;

  // Cmd/Ctrl+click: jump to source on GitHub. The hover label can't host a
  // clickable link (it follows the cursor), so the affordance lives on the
  // highlighted rect itself via this modifier.
  if (jumpModifierActive(e)) {
    const url = buildGithubUrl(
      options.value.githubRepo,
      options.value.commitHash,
      info.path,
      info.line,
    );
    if (url) window.open(url, "_blank", "noopener");
    return;
  }

  const anchor = (inst.subTree?.el ?? inst.vnode?.el) as Element | null;
  const targetEl = findInspectorDescendant(anchor, data) ?? document.body;
  const sel: SelectedComponent = {
    path: info.path,
    line: info.line,
    v_for_index: findOccurrenceIndex(targetEl, data),
    name: instanceName(inst),
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
  if (!anchor || anchor.nodeType !== 1) return;
  const r = (anchor as Element).getBoundingClientRect();
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

function onComposerKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    composerFormEl.value?.requestSubmit();
  }
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
useEventListener(window, "keydown", onKey);

onScopeDispose(() => setHoverAnchor(null));
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
      <form ref="composerFormEl" class="sn-form" @submit.prevent="submitComposer">
        <textarea
          v-model="composer.body"
          placeholder="Leave a comment…"
          autofocus
          @keydown="onComposerKeydown"
        />
        <div class="sn-form-actions">
          <button type="button" @click="closeComposer">cancel</button>
          <button
            type="submit"
            class="sn-primary"
            :disabled="composer.saving || !composer.body.trim()"
          >
            {{ composer.saving ? "Saving…" : "Pin" }}
          </button>
        </div>
      </form>
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
