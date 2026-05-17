<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";

import { useAnchorBinding } from "../anchor-binding.ts";
import { clamp } from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";
import { openThread, openThreadId } from "../state.ts";
import type { Thread } from "../types.ts";

const props = defineProps<{ thread: Thread }>();

const updatePosition = useMutation(serverMutations.threads.updatePosition(), queryClient);
const { data: comments } = useQuery(
  {
    ...serverQueries.threads.comments.list(props.thread.id),
    enabled: () => openThreadId.value === props.thread.id,
  },
  queryClient,
);

const canDrag = computed(() => props.thread.components.length > 0);
const anchorName = `--sn-pin-${props.thread.id}`;
const { element: anchor } = useAnchorBinding(() => props.thread.components[0] ?? null, anchorName);

const dragPos = ref<{ x: number; y: number } | null>(null);
const dragging = computed(() => dragPos.value !== null);

const DRAG_THRESHOLD = 4;
let dragStart: { x: number; y: number } | null = null;
let anchorRectAtStart: DOMRect | null = null;

const stale = computed(() => canDrag.value && anchor.value == null);
const isOpen = computed(() => openThreadId.value === props.thread.id);
const label = computed(() => comments.value?.length ?? 1);

// The CSS rule `.sn-pin-anchored:not(.sn-pin-dragging)` reads `--x` / `--y`
// and resolves position via `anchor()`. While dragging we hand the pin
// explicit pixel coords from the pointer; the `:not(.sn-pin-dragging)`
// guard lets those win without `!important`.
const pinStyle = computed<Record<string, string>>(() => {
  if (dragPos.value) {
    return { left: `${dragPos.value.x}px`, top: `${dragPos.value.y}px` };
  }
  if (canDrag.value && anchor.value) {
    return {
      positionAnchor: anchorName,
      "--x": String(props.thread.x_ratio),
      "--y": String(props.thread.y_ratio),
    };
  }
  return {};
});

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
    if (!anchor.value) return;
    anchorRectAtStart = anchor.value.getBoundingClientRect();
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
    openThread(props.thread.id);
    return;
  }
  const r = anchorRectAtStart;
  const pos = dragPos.value;
  if (r && pos && r.width > 0 && r.height > 0) {
    const xr = clamp((pos.x - r.left) / r.width);
    const yr = clamp((pos.y - r.top) / r.height);
    updatePosition.mutate({ threadId: props.thread.id, x_ratio: xr, y_ratio: yr });
  }
  resetDrag();
}

function onPointerCancel(e: PointerEvent): void {
  const target = e.currentTarget as Element;
  if (target.hasPointerCapture?.(e.pointerId)) {
    target.releasePointerCapture?.(e.pointerId);
  }
  resetDrag();
}
</script>

<template>
  <button
    v-if="!stale"
    type="button"
    class="sn-pin"
    :class="{
      'sn-pin-resolved': props.thread.status === 'resolved',
      'sn-pin-open': isOpen,
      'sn-pin-draggable': canDrag,
      'sn-pin-dragging': dragging,
      'sn-pin-anchored': canDrag && !!anchor && !dragging,
      'sn-pin-pagewide': !canDrag,
    }"
    :style="pinStyle"
    :title="`${props.thread.created_by_name}: ${label} comment(s)`"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    {{ label }}
  </button>
</template>

<style scoped>
/* Anchored pins follow their host element entirely via the browser's CSS
   Anchor Positioning. `anchor()` reads the bound edge, `anchor-size()` the
   bound size; the thread's stored 0..1 ratios scale within that box. */
.sn-pin-anchored {
  left: calc(anchor(left) + anchor-size(width) * var(--x));
  top: calc(anchor(top) + anchor-size(height) * var(--y));
}
/* Page-wide threads (no anchor) park in the top-right of the viewport,
   matching the previous JS fallback position. */
.sn-pin-pagewide {
  right: 12px;
  top: 80px;
  left: auto;
}
</style>
