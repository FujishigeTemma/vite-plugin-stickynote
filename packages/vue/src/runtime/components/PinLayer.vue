<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  type InjectionKey,
  type Ref,
} from "vue";
import { useStore } from "../store-inject.ts";
import Pin from "./Pin.vue";

const store = useStore();

// Single shared "tick" — every pin watches this and recomputes its position.
// We increment on scroll, resize, and DOM mutations, debounced through rAF.
const tick = ref(0);
const TICK_KEY: InjectionKey<Ref<number>> = Symbol.for("stickynote:tick");
provide(TICK_KEY, tick);

let raf = 0;
function bump(): void {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    tick.value++;
  });
}

let mo: MutationObserver | null = null;
let ro: ResizeObserver | null = null;

onMounted(() => {
  window.addEventListener("scroll", bump, true);
  window.addEventListener("resize", bump);
  mo = new MutationObserver(bump);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true });
  ro = new ResizeObserver(bump);
  ro.observe(document.body);
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", bump, true);
  window.removeEventListener("resize", bump);
  mo?.disconnect();
  ro?.disconnect();
  cancelAnimationFrame(raf);
});

// Only render pins for the current route. Resolved pins are hidden unless the
// user explicitly opted in via the panel toggle (PLAN 5.3).
const visibleThreads = computed(() =>
  store.threadsForCurrentRoute.value.filter((t) =>
    store.showResolved.value ? true : t.status === "open",
  ),
);
</script>

<template>
  <Pin v-for="thread in visibleThreads" :key="thread.id" :thread="thread" />
</template>
