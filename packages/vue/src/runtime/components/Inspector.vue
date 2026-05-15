<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import {
  ancestorsWithInspector,
  buildGithubUrl,
  componentName,
  fallbackToVueParent,
  findOccurrenceIndex,
  getInspectorData,
  parseInspector,
} from "../inspector.ts";
import { useStore } from "../store-inject.ts";

const store = useStore();

type Highlight = {
  rect: { left: number; top: number; width: number; height: number };
  inspector: { path: string; line: number; column: number };
  componentName: string;
  githubUrl: string | null;
};

const highlight = ref<Highlight | null>(null);
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
let rafQueued = false;

function shouldIgnore(el: Element | null): boolean {
  let n: Element | null = el;
  while (n) {
    if (n.id === "stickynote-overlay-root") return true;
    n = n.parentElement;
  }
  return false;
}

function pickTarget(e: MouseEvent): Element | null {
  for (const node of e.composedPath()) {
    if (!(node instanceof Element)) continue;
    if (shouldIgnore(node)) return null;
    const el = fallbackToVueParent(node) ?? (getInspectorData(node) ? node : null);
    if (el) {
      // Walk up by altDepth.
      const chain = ancestorsWithInspector(el);
      return chain[Math.min(altDepth, chain.length - 1)] ?? el;
    }
  }
  return null;
}

function setHighlightFromEvent(): void {
  rafQueued = false;
  if (!lastEvent) return;
  if (composer.visible) return;
  const target = pickTarget(lastEvent);
  if (!target) {
    highlight.value = null;
    return;
  }
  const data = getInspectorData(target);
  const info = parseInspector(data);
  if (!info) {
    highlight.value = null;
    return;
  }
  const r = target.getBoundingClientRect();
  highlight.value = {
    rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    inspector: { path: info.path, line: info.line, column: info.column },
    componentName: componentName(info.path),
    githubUrl: buildGithubUrl(
      store.options.githubRepo,
      store.options.commitHash,
      info.path,
      info.line,
    ),
  };
}

function onMouseMove(e: MouseEvent): void {
  lastEvent = e;
  if (!rafQueued) {
    rafQueued = true;
    requestAnimationFrame(setHighlightFromEvent);
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Alt") {
    altDepth = e.type === "keydown" ? altDepth + 1 : 0;
    setHighlightFromEvent();
  }
  if (e.key === "Escape") {
    if (composer.visible) closeComposer();
    else store.setMode("idle");
  }
}

function onClickCapture(e: MouseEvent): void {
  // Ignore clicks inside our own overlay (panel, statusbar, composer).
  if (e.target instanceof Element && shouldIgnore(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  const target = pickTarget(e);
  if (!target) return;
  const data = getInspectorData(target);
  const info = parseInspector(data);
  if (!info || !data) return;

  const r = target.getBoundingClientRect();
  composer.rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  composer.pinX = e.clientX;
  composer.pinY = e.clientY;
  composer.target = {
    component_path: info.path,
    component_line: info.line,
    component_index: findOccurrenceIndex(target, data),
  };
  composer.body = "";
  composer.visible = true;
  highlight.value = null;
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
    store.setMode("idle");
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
  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClickCapture, true);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousemove", onMouseMove, true);
  document.removeEventListener("click", onClickCapture, true);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("keyup", onKey);
});
</script>

<template>
  <template v-if="highlight">
    <div
      class="sn-inspect-rect"
      :style="{
        left: highlight.rect.left + 'px',
        top: highlight.rect.top + 'px',
        width: highlight.rect.width + 'px',
        height: highlight.rect.height + 'px',
      }"
    />
    <div
      class="sn-inspect-label"
      :style="{
        left: highlight.rect.left + 'px',
        top: highlight.rect.top + highlight.rect.height + 6 + 'px',
      }"
    >
      <span class="sn-name">{{ highlight.componentName }}</span>
      <span>{{ highlight.inspector.path }}:{{ highlight.inspector.line }}</span>
      <a
        v-if="highlight.githubUrl"
        :href="highlight.githubUrl"
        target="_blank"
        rel="noopener"
        @click.stop
        >github</a
      >
    </div>
  </template>

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
