<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from "vue";
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
let altDepth = 0;
let shiftHeld = false;

const HOST_ID = "stickynote-overlay-root";

function eventInOverlay(e: MouseEvent): boolean {
  return e.composedPath().some((n) => n instanceof Element && n.id === HOST_ID);
}

// Resolve the Vue component owning the hovered DOM element. Walks up via
// `__vueParentComponent` per PLAN §7.9 so non-Vue elements (text, bare divs)
// fall back to their nearest owning component. Then climbs `parent` by
// altDepth so Alt walks outward.
function pickInstance(e: MouseEvent): Instance | null {
  const target = e.target;
  if (!(target instanceof Element)) return null;
  const owner = findInstance(target);
  if (!owner) return null;
  const chain = ancestorChain(owner);
  return chain[Math.min(altDepth, chain.length - 1)] ?? owner;
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
  if (shiftHeld && info && githubUrl) {
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

function onMouseOut(e: MouseEvent): void {
  // Mouse leaving the viewport entirely (relatedTarget null) — clear.
  if (!e.relatedTarget) {
    lastEvent = null;
    hideHighlight();
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Alt") {
    altDepth = e.type === "keydown" ? altDepth + 1 : 0;
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

const composerStyle = computed<Record<string, string>>(() => {
  if (!composer.visible || !composer.rect) return {};
  return {
    left: Math.min(window.innerWidth - 340, composer.pinX + 12) + "px",
    top: Math.min(window.innerHeight - 220, composer.pinY + 12) + "px",
  };
});

onMounted(() => {
  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("mouseout", onMouseOut, true);
  document.addEventListener("click", onClickCapture, true);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener("mouseover", onMouseOver, true);
  document.removeEventListener("mouseout", onMouseOut, true);
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
