<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive, watch } from "vue";
import { TICK_KEY } from "../cache.ts";
import { hideHighlight, removeHighlight, showHighlight } from "../highlight.ts";
import {
  buildGithubUrl,
  componentName,
  findOccurrenceIndex,
  parseInspector,
} from "../inspector.ts";
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

const composer = reactive<{
  visible: boolean;
  body: string;
  saving: boolean;
  rect: { left: number; top: number; width: number; height: number } | null;
  pinX: number;
  pinY: number;
  target: {
    component_path: string | null;
    component_line: number | null;
    component_index: number;
  } | null;
}>({
  visible: false,
  body: "",
  saving: false,
  rect: null,
  pinX: 0,
  pinY: 0,
  target: null,
});

let lastEvent: MouseEvent | null = null;
let altHeld = false;
let shiftHeld = false;

function eventInOverlay(e: Event): boolean {
  return e
    .composedPath()
    .some((n) => n instanceof Element && n.hasAttribute("data-stickynote-ignore"));
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

function renderHighlight(): void {
  if (composer.visible || !lastEvent) {
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
  if ((lastEvent.shiftKey || shiftHeld) && info && githubUrl) {
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
  if (e.key === "Shift") {
    shiftHeld = e.type === "keydown";
    renderHighlight();
  }
  if (e.key === "Escape") {
    if (composer.visible) closeComposer();
    else store.toggleActive();
  }
}

function onClickCapture(e: MouseEvent): void {
  if (eventInOverlay(e)) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  const inst = pickInstance(e);
  if (!inst) return;
  const data = instanceInspector(inst);
  const info = data ? parseInspector(data) : null;
  if (!info || !data) return;

  // Shift+click jumps to source on GitHub instead of opening the composer.
  // The hover label can't host a clickable link (it follows the cursor and
  // would disappear before reaching it), so the affordance lives on the
  // highlighted rect itself via this modifier.
  if (e.shiftKey) {
    const url = buildGithubUrl(
      store.options.githubRepo,
      store.options.commitHash,
      info.path,
      info.line,
    );
    if (url) window.open(url, "_blank", "noopener");
    return;
  }

  const r = instanceRect(inst);
  if (!r) return;

  // findOccurrenceIndex needs a real element with the attribute. The
  // instance's first inspector-tagged descendant is the anchor.
  const anchor = (inst.subTree?.el ?? inst.vnode?.el) as Element | null;
  const targetEl = findAnchorElement(anchor, data) ?? document.body;

  composer.rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  composer.pinX = e.clientX;
  composer.pinY = e.clientY;
  composer.target = {
    component_path: info.path,
    component_line: info.line,
    component_index: findOccurrenceIndex(targetEl, data),
  };
  composer.body = "";
  composer.visible = true;
  hideHighlight();
}

function findAnchorElement(start: Element | null, data: string): Element | null {
  if (!start) return null;
  if (start.getAttribute?.("data-v-inspector") === data) return start;
  return start.querySelector?.(`[data-v-inspector="${CSS.escape(data)}"]`) ?? null;
}

function closeComposer(): void {
  composer.visible = false;
  composer.target = null;
  composer.rect = null;
  composer.body = "";
  composer.saving = false;
}

async function submitComposer(): Promise<void> {
  if (!composer.target || !composer.rect) return;
  if (!composer.body.trim()) return;
  composer.saving = true;
  const x_ratio = (composer.pinX - composer.rect.left) / composer.rect.width;
  const y_ratio = (composer.pinY - composer.rect.top) / composer.rect.height;
  try {
    await store.createThread({
      component_path: composer.target.component_path,
      component_line: composer.target.component_line,
      component_index: composer.target.component_index,
      commit_hash: store.options.commitHash,
      dirty_build: store.options.dirtyBuild,
      x_ratio: clamp01(x_ratio),
      y_ratio: clamp01(y_ratio),
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
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
// highlight follows the source element instead of disappearing.
watch(() => tick?.value ?? 0, renderHighlight);

onMounted(() => {
  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("click", onClickCapture, true);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener("mouseover", onMouseOver, true);
  document.removeEventListener("click", onClickCapture, true);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("keyup", onKey);
  removeHighlight();
});
</script>

<template>
  <div
    v-if="composer.visible && composer.rect"
    class="sn-composer-overlay"
    :style="composerStyle"
    @click.stop
  >
    <div class="sn-composer-target">
      {{ composer.target?.component_path }}:{{ composer.target?.component_line }} (#{{
        composer.target?.component_index
      }})
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
  z-index: 2147483120;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sn-composer-target {
  font-size: 11px;
  color: #6b7280;
  font-family: ui-monospace, monospace;
}
</style>
