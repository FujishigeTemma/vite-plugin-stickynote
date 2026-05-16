<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive, watch } from "vue";
import { ELEMENT_MAP_KEY, TICK_KEY } from "../cache.ts";
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
  componentName,
  findElementInMap,
  findOccurrenceIndex,
  parseInspector,
} from "../inspector.ts";
import { isJumpModifier } from "../platform.ts";
import { useStore } from "../store-inject.ts";
import {
  ancestorChain,
  findInstance,
  type Instance,
  instanceInspector,
  instanceName,
  instanceRect,
} from "../vue-instance.ts";

const store = useStore();
const tick = inject(TICK_KEY);
const elementMap = inject(ELEMENT_MAP_KEY);

type SelectedComponent = {
  component_path: string;
  component_line: number;
  component_index: number;
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

// Resolve the Vue component owning the hovered DOM element. Walks up via
// `__vueParentComponent` per PLAN §7.9 so non-Vue elements (text, bare divs)
// fall back to their nearest owning component. With Alt held, step one
// level outward.
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
  if (!lastEvent) {
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
    ? buildGithubUrl(store.options.githubRepo, store.options.commitHash, info.path, info.line)
    : null;
  const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  if (jumpModifierActive(lastEvent) && info && githubUrl) {
    showHighlight({
      rect,
      mode: "jump",
      source: `${info.path}:${info.line}`,
      commit: store.options.commitHash,
    });
  } else {
    showHighlight({
      rect,
      mode: "info",
      name: info ? componentName(info.path) : name,
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
    else store.toggleActive();
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
  // capture-phase preventDefault also suppresses host <a> navigation, so
  // the jump path's window.open is the only navigation that runs.
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  const inst = pickInstance(e);
  if (!inst) return;
  const data = instanceInspector(inst);
  const info = data ? parseInspector(data) : null;
  if (!info || !data) return;

  // Cmd (mac) / Ctrl (win/linux) + click: jump to source on GitHub. The
  // hover label can't host a clickable link (it follows the cursor and
  // would disappear before reaching it), so the affordance lives on the
  // highlighted rect itself via this modifier.
  if (jumpModifierActive(e)) {
    const url = buildGithubUrl(
      store.options.githubRepo,
      store.options.commitHash,
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

  // Plain click (or shift+click with no composer): open a new composer for
  // this single component. Any in-progress composer is discarded.
  const r = instanceRect(inst);
  if (!r) return;
  composer.rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  composer.pinX = e.clientX;
  composer.pinY = e.clientY;
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
  if (!composer.visible || !composer.primary) {
    clearSelectionHighlights();
    return;
  }
  const map = elementMap?.value;
  if (!map) {
    clearSelectionHighlights();
    return;
  }
  const items: SelectionRect[] = [];
  const all: Array<SelectedComponent & { primary: boolean }> = [
    { ...composer.primary, primary: true },
    ...composer.additional.map((c) => ({ ...c, primary: false })),
  ];
  for (const c of all) {
    const el = findElementInMap(map, c.component_path, c.component_line, c.component_index);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    items.push({
      key: `${c.component_path}:${c.component_line}#${c.component_index}`,
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      label: `${c.primary ? "★ " : ""}${componentName(c.component_path)}`,
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
  clearSelectionHighlights();
}

async function submitComposer(): Promise<void> {
  if (!composer.primary || !composer.rect) return;
  if (!composer.body.trim()) return;
  composer.saving = true;
  const x_ratio = (composer.pinX - composer.rect.left) / composer.rect.width;
  const y_ratio = (composer.pinY - composer.rect.top) / composer.rect.height;
  try {
    await store.createThread({
      component_path: composer.primary.component_path,
      component_line: composer.primary.component_line,
      component_index: composer.primary.component_index,
      commit_hash: store.options.commitHash,
      dirty_build: store.options.dirtyBuild,
      x_ratio: clamp01(x_ratio),
      y_ratio: clamp01(y_ratio),
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      additional_components: composer.additional.map((c) => ({
        path: c.component_path,
        line: c.component_line,
        index: c.component_index,
      })),
      body: composer.body,
    });
    closeComposer();
  } catch (err) {
    console.error("[stickynote] failed to create thread", err);
  } finally {
    composer.saving = false;
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

const composerStyle = computed(() => ({
  left: Math.min(window.innerWidth - 340, composer.pinX + 12) + "px",
  top: Math.min(window.innerHeight - 220, composer.pinY + 12) + "px",
}));

// Recompute on every overlay tick (scroll, resize, DOM mutation) so the
// highlight and selection rects follow their source elements.
watch(
  () => tick?.value ?? 0,
  () => {
    renderHighlight();
    refreshSelectionHighlights();
  },
);

onMounted(() => {
  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("click", onClickCapture, true);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("blur", onWindowBlur);
});

onBeforeUnmount(() => {
  document.removeEventListener("mouseover", onMouseOver, true);
  document.removeEventListener("click", onClickCapture, true);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("keyup", onKey);
  window.removeEventListener("blur", onWindowBlur);
  removeHighlight();
});
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
      class="sn-composer-overlay"
      :style="composerStyle"
      @click.stop
    >
      <div class="sn-composer-target">
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
