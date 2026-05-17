<script setup lang="ts">
import { useMutation } from "@tanstack/vue-query";
import { useDraggable, useEventListener } from "@vueuse/core";
import { computed, onBeforeUnmount, reactive, useTemplateRef, watch } from "vue";

import { useThreadsList } from "../composables.ts";
import {
  clearSelectionHighlights,
  hideHighlight,
  removeHighlight,
  showHighlight,
  showSelectionHighlights,
  type SelectionRect,
} from "../highlight.ts";
import {
  buildGithubUrl,
  clamp,
  findElementInMap,
  findOccurrenceIndex,
  parseInspector,
} from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { isJumpModifier } from "../platform.ts";
import { queryClient } from "../query-client.ts";
import { elementMap, openThreadId, options, tick, toggleActive } from "../state.ts";
import {
  ancestorChain,
  findInstance,
  instanceInspector,
  instanceName,
  instanceRect,
  type Instance,
} from "../vue-instance.ts";

const { threads } = useThreadsList();
const createThread = useMutation(serverMutations.threads.create(), queryClient);

type SelectedComponent = {
  component_path: string;
  component_line: number;
  component_index: number;
  component_name: string;
};

const composer = reactive<{
  visible: boolean;
  body: string;
  saving: boolean;
  rect: { left: number; top: number; width: number; height: number } | null;
  pinX: number;
  pinY: number;
  primary: SelectedComponent | null;
  additional: SelectedComponent[];
}>({
  visible: false,
  body: "",
  saving: false,
  rect: null,
  pinX: 0,
  pinY: 0,
  primary: null,
  additional: [],
});

const composerEl = useTemplateRef<HTMLElement>("composerEl");
const composerHandleEl = useTemplateRef<HTMLElement>("composerHandleEl");

const { x: dialogX, y: dialogY } = useDraggable(composerEl, {
  handle: composerHandleEl,
  initialValue: { x: 0, y: 0 },
  preventDefault: true,
});

let lastEvent: MouseEvent | null = null;
let altHeld = false;
let metaHeld = false;
let ctrlHeld = false;

// `composedPath()` returns [] once an event finishes dispatching, and
// `renderHighlight()` re-runs against `lastEvent` from a tick watcher, so a
// path-based guard would let the plugin's own UI sneak through after the
// first frame. The target node reference stays valid, so walk the DOM.
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
  if (!(altHeld || e.altKey)) return owner;
  const chain = ancestorChain(owner);
  return chain[1] ?? owner;
}

function jumpModifierActive(e?: MouseEvent | KeyboardEvent): boolean {
  return isJumpModifier({
    metaKey: metaHeld || !!e?.metaKey,
    ctrlKey: ctrlHeld || !!e?.ctrlKey,
  });
}

function renderHighlight(): void {
  if (!lastEvent || !options.value) {
    hideHighlight();
    return;
  }
  if (eventInOverlay(lastEvent)) {
    hideHighlight();
    return;
  }
  const inst = pickInstance(lastEvent);
  if (!inst) {
    hideHighlight();
    return;
  }
  const r = instanceRect(inst);
  if (!r || (r.width === 0 && r.height === 0)) {
    hideHighlight();
    return;
  }
  const data = instanceInspector(inst);
  const info = data ? parseInspector(data) : null;
  const name = instanceName(inst);
  const githubUrl = info
    ? buildGithubUrl(options.value.githubRepo, options.value.commitHash, info.path, info.line)
    : null;
  const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  if (jumpModifierActive(lastEvent) && info && githubUrl) {
    showHighlight({
      rect,
      mode: "jump",
      source: `${info.path}:${info.line}`,
      commit: options.value.commitHash,
    });
  } else {
    showHighlight({
      rect,
      mode: "info",
      name,
      source: info ? `${info.path}:${info.line}` : null,
    });
  }
}

function onMouseOver(e: MouseEvent): void {
  lastEvent = e;
  renderHighlight();
}

function onKey(e: KeyboardEvent): void {
  if (e.repeat) return;
  if (e.key === "Alt") {
    altHeld = e.type === "keydown";
    renderHighlight();
  }
  if (e.key === "Meta") {
    metaHeld = e.type === "keydown";
    renderHighlight();
  }
  if (e.key === "Control") {
    ctrlHeld = e.type === "keydown";
    renderHighlight();
  }
  if (e.key === "Escape") {
    if (composer.visible) closeComposer();
    else toggleActive();
  }
}

// Modifier keyup is lost when the window blurs (Cmd+Tab etc.), so flags
// would otherwise stick "true" and leave the highlight in jump mode forever.
function onWindowBlur(): void {
  altHeld = metaHeld = ctrlHeld = false;
  renderHighlight();
}

function sameComponent(a: SelectedComponent, b: SelectedComponent): boolean {
  return (
    a.component_path === b.component_path &&
    a.component_line === b.component_line &&
    a.component_index === b.component_index
  );
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
  const targetEl = findAnchorElement(anchor, data) ?? document.body;
  const sel: SelectedComponent = {
    component_path: info.path,
    component_line: info.line,
    component_index: findOccurrenceIndex(targetEl, data),
    component_name: instanceName(inst),
  };

  // Shift+click with composer open: Finder-style multi-select. Toggle the
  // component in/out of the additional list (primary is fixed because it
  // anchors the pin coordinates).
  if (e.shiftKey && composer.visible && composer.primary) {
    if (sameComponent(composer.primary, sel)) return;
    const i = composer.additional.findIndex((c) => sameComponent(c, sel));
    if (i >= 0) composer.additional.splice(i, 1);
    else composer.additional.push(sel);
    refreshSelectionHighlights();
    return;
  }

  // Plain click (or shift+click with no composer): open a new composer.
  const r = instanceRect(inst);
  if (!r) return;
  composer.rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  composer.pinX = e.clientX;
  composer.pinY = e.clientY;
  dialogX.value = Math.min(window.innerWidth - 340, Math.max(0, e.clientX + 12));
  dialogY.value = Math.min(window.innerHeight - 220, Math.max(0, e.clientY + 12));
  composer.primary = sel;
  composer.additional = [];
  composer.body = "";
  composer.visible = true;
  refreshSelectionHighlights();
}

function findAnchorElement(start: Element | null, data: string): Element | null {
  if (!start) return null;
  if (start.getAttribute?.("data-v-inspector") === data) return start;
  return start.querySelector?.(`[data-v-inspector="${CSS.escape(data)}"]`) ?? null;
}

function refreshSelectionHighlights(): void {
  const map = elementMap.value;
  const composerActive = composer.visible && composer.primary;
  const openId = openThreadId.value;
  if (!composerActive && !openId) {
    clearSelectionHighlights();
    return;
  }
  // Composer takes priority over an open thread when both are present.
  let all: Array<SelectedComponent & { primary: boolean }> | null = null;
  if (composerActive && composer.primary) {
    all = [
      { ...composer.primary, primary: true },
      ...composer.additional.map((c) => ({ ...c, primary: false })),
    ];
  } else {
    const thread = openId ? threads.value.find((t) => t.id === openId) : null;
    if (
      thread &&
      thread.component_path != null &&
      thread.component_line != null &&
      thread.component_name != null
    ) {
      all = [
        {
          component_path: thread.component_path,
          component_line: thread.component_line,
          component_index: thread.component_index,
          component_name: thread.component_name,
          primary: true,
        },
        ...(thread.additional_components ?? []).map((c) => ({
          component_path: c.path,
          component_line: c.line,
          component_index: c.index,
          component_name: c.name,
          primary: false,
        })),
      ];
    }
  }
  if (!all) {
    clearSelectionHighlights();
    return;
  }
  const items: SelectionRect[] = [];
  for (const c of all) {
    const el = findElementInMap(map, c.component_path, c.component_line, c.component_index);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    items.push({
      key: `${c.component_path}:${c.component_line}#${c.component_index}`,
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      label: `${c.primary ? "★ " : ""}${c.component_name}`,
    });
  }
  showSelectionHighlights(items);
}

function removeAdditional(i: number): void {
  composer.additional.splice(i, 1);
  refreshSelectionHighlights();
}

function closeComposer(): void {
  composer.visible = false;
  composer.primary = null;
  composer.additional = [];
  composer.rect = null;
  composer.body = "";
  composer.saving = false;
  refreshSelectionHighlights();
}

function submitComposer(): void {
  if (!composer.primary || !composer.rect || !options.value) return;
  if (!composer.body.trim()) return;
  composer.saving = true;
  const x_ratio = (composer.pinX - composer.rect.left) / composer.rect.width;
  const y_ratio = (composer.pinY - composer.rect.top) / composer.rect.height;
  createThread.mutate(
    {
      component_path: composer.primary.component_path,
      component_line: composer.primary.component_line,
      component_index: composer.primary.component_index,
      component_name: composer.primary.component_name,
      commit_hash: options.value.commitHash,
      dirty_build: options.value.dirtyBuild,
      x_ratio: clamp(x_ratio),
      y_ratio: clamp(y_ratio),
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      additional_components: composer.additional.map((c) => ({
        path: c.component_path,
        line: c.component_line,
        index: c.component_index,
        name: c.component_name,
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

watch(tick, () => {
  renderHighlight();
  refreshSelectionHighlights();
});

watch(openThreadId, () => refreshSelectionHighlights());

useEventListener(document, "mouseover", onMouseOver, { capture: true });
useEventListener(document, "click", onClickCapture, { capture: true });
useEventListener(window, "keydown", onKey);
useEventListener(window, "keyup", onKey);
useEventListener(window, "blur", onWindowBlur);

onBeforeUnmount(() => removeHighlight());
</script>

<template>
  <!-- Teleport to the trailing `.sn-composer-layer` inside `.sn-root` so the
  composer ends up as the last DOM child of the plugin's stacking context —
  naturally above the highlight overlays, pins, and panel without needing its
  own z-index. `defer` lets Vue resolve the target after App.vue has rendered
  it on the same tick. -->
  <Teleport to=".sn-composer-layer" defer>
    <div
      v-if="composer.visible && composer.rect"
      ref="composerEl"
      class="sn-composer-overlay"
      :style="composerStyle"
      @click.stop
    >
      <div ref="composerHandleEl" class="sn-composer-target">
        <div class="sn-composer-primary">
          {{ composer.primary?.component_path }}:{{ composer.primary?.component_line }} (#{{
            composer.primary?.component_index
          }})
        </div>
        <div v-if="composer.additional.length" class="sn-composer-additional">
          <div
            v-for="(c, i) in composer.additional"
            :key="`${c.component_path}:${c.component_line}#${c.component_index}`"
            class="sn-chip"
          >
            <span class="sn-chip-text"
              >{{ c.component_path }}:{{ c.component_line }} (#{{ c.component_index }})</span
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
