<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { ELEMENT_MAP_KEY, TICK_KEY } from "../cache.ts";
import { findElementInMap } from "../inspector.ts";
import { useStore } from "../store-inject.ts";
import type { Thread } from "../types.ts";

const props = defineProps<{ thread: Thread }>();
const store = useStore();

const tick = inject(TICK_KEY);
const elementMap = inject(ELEMENT_MAP_KEY);

const position = ref<{ x: number; y: number } | null>(null);
const stale = ref(false);

function compute(): void {
  if (props.thread.component_path == null || props.thread.component_line == null) {
    // Page-wide pin: anchor to top-right of viewport.
    position.value = { x: window.innerWidth - 60, y: 80 };
    stale.value = false;
    return;
  }
  const map = elementMap?.value;
  const el = map
    ? findElementInMap(
        map,
        props.thread.component_path,
        props.thread.component_line,
        props.thread.component_index,
      )
    : null;
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

// Recompute whenever the overlay cache fires a tick (scroll, resize, DOM).
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

function open(): void {
  void store.openThread(props.thread.id);
}
</script>

<template>
  <button
    v-if="position"
    type="button"
    class="sn-pin"
    :class="{
      'sn-pin-resolved': props.thread.status === 'resolved',
      'sn-pin-stale': stale,
      'sn-pin-open': isOpen,
    }"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    :title="`${props.thread.created_by_name}: ${label} comment(s)`"
    @click="open"
  >
    {{ label }}
  </button>
</template>
