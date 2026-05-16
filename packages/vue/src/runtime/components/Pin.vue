<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { ELEMENT_MAP_KEY, TICK_KEY } from "../cache.ts";
import { findThreadAnchor } from "../inspector.ts";
import { useStore } from "../store-inject.ts";
import type { Thread } from "../types.ts";

const props = defineProps<{ thread: Thread }>();
const store = useStore();

const tick = inject(TICK_KEY);
const elementMap = inject(ELEMENT_MAP_KEY);

const position = ref<{ x: number; y: number } | null>(null);
const stale = ref(false);

const dragPos = ref<{ x: number; y: number } | null>(null);
const dragging = computed(() => dragPos.value !== null);

const DRAG_THRESHOLD = 4;
let dragStart: { x: number; y: number } | null = null;
let anchorRectAtStart: DOMRect | null = null;

const canDrag = computed(
  () => props.thread.component_path != null && props.thread.component_line != null,
);

function findAnchor(): Element | null {
  const map = elementMap?.value;
  if (!map) return null;
  return findThreadAnchor(props.thread, map);
}

function compute(): void {
  if (dragging.value) return;
  if (!canDrag.value) {
    position.value = { x: window.innerWidth - 60, y: 80 };
    stale.value = false;
    return;
  }
  const el = findAnchor();
  if (!el) {
    position.value = null;
    stale.value = true;
    return;
  }
  const r = el.getBoundingClientRect();
  position.value = {
    x: r.left + r.width * props.thread.x_ratio,
    y: r.top + r.height * props.thread.y_ratio,
  };
  stale.value = false;
}

watch(
  () => tick?.value ?? 0,
  () => compute(),
  { immediate: true },
);

const isOpen = computed(() => store.openThreadId.value === props.thread.id);
const label = computed(() => {
  const list = store.commentsByThread[props.thread.id];
  return list ? list.length : 1;
});

const displayPos = computed(() => dragPos.value ?? position.value);

function open(): void {
  void store.openThread(props.thread.id);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return;
  dragStart = { x: e.clientX, y: e.clientY };
  if (canDrag.value) {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!dragStart) return;
  if (!dragging.value) {
    if (!canDrag.value) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    const el = findAnchor();
    if (!el) return;
    anchorRectAtStart = el.getBoundingClientRect();
    e.preventDefault();
  }
  dragPos.value = { x: e.clientX, y: e.clientY };
}

function resetDrag(): void {
  dragPos.value = null;
  dragStart = null;
  anchorRectAtStart = null;
}

function onPointerUp(e: PointerEvent): void {
  const wasDragging = dragging.value;
  const target = e.currentTarget as Element;
  if (target.hasPointerCapture?.(e.pointerId)) {
    target.releasePointerCapture?.(e.pointerId);
  }
  if (!wasDragging) {
    resetDrag();
    open();
    return;
  }
  const r = anchorRectAtStart;
  const pos = dragPos.value;
  if (r && pos && r.width > 0 && r.height > 0) {
    const xr = clamp01((pos.x - r.left) / r.width);
    const yr = clamp01((pos.y - r.top) / r.height);
    void store.updateThreadPosition(props.thread, xr, yr);
  }
  resetDrag();
  // Store splice doesn't fire `tick`, so position would stay stale until the next scroll/resize.
  compute();
}

function onPointerCancel(e: PointerEvent): void {
  const target = e.currentTarget as Element;
  if (target.hasPointerCapture?.(e.pointerId)) {
    target.releasePointerCapture?.(e.pointerId);
  }
  resetDrag();
  compute();
}
</script>

<template>
  <button
    v-if="displayPos"
    type="button"
    class="sn-pin"
    :class="{
      'sn-pin-resolved': props.thread.status === 'resolved',
      'sn-pin-stale': stale,
      'sn-pin-open': isOpen,
      'sn-pin-draggable': canDrag,
      'sn-pin-dragging': dragging,
    }"
    :style="{ left: displayPos.x + 'px', top: displayPos.y + 'px' }"
    :title="`${props.thread.created_by_name}: ${label} comment(s)`"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    {{ label }}
  </button>
</template>
