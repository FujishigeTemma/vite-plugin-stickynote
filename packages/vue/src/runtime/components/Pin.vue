<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";

import { clamp, findThreadAnchor } from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";
import { elementMap, openThread, openThreadId, tick } from "../state.ts";
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

const dragPos = ref<{ x: number; y: number } | null>(null);
const dragging = computed(() => dragPos.value !== null);

const DRAG_THRESHOLD = 4;
let dragStart: { x: number; y: number } | null = null;
let anchorRectAtStart: DOMRect | null = null;

const canDrag = computed(() => props.thread.components.length > 0);

const anchor = computed<Element | null>(() => {
  void tick.value; // re-evaluate as DOM changes
  if (!canDrag.value) return null;
  return findThreadAnchor(props.thread, elementMap.value);
});

const restingPos = computed<{ x: number; y: number } | null>(() => {
  void tick.value;
  if (!canDrag.value) return { x: window.innerWidth - 60, y: 80 };
  if (!anchor.value) return null;
  const r = anchor.value.getBoundingClientRect();
  return {
    x: r.left + r.width * props.thread.x_ratio,
    y: r.top + r.height * props.thread.y_ratio,
  };
});

const stale = computed(() => canDrag.value && anchor.value == null);
const isOpen = computed(() => openThreadId.value === props.thread.id);
const label = computed(() => comments.value?.length ?? 1);
const displayPos = computed(() => dragPos.value ?? restingPos.value);

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
