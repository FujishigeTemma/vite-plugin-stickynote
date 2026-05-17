import { useEventListener, useMutationObserver, useResizeObserver } from "@vueuse/core";
import { computed, onScopeDispose, watch } from "vue";

import { buildElementMap } from "./inspector.ts";
import { active, elementMap, tick } from "./state.ts";

// VueUse observer/event composables auto-disconnect when their target ref
// becomes nullish, so flipping the target on `active` gives us start/stop
// semantics for free.
export function useDomTracker(): void {
  const bodyWhenActive = computed(() => (active.value ? document.body : undefined));
  const windowWhenActive = computed(() => (active.value ? window : undefined));

  let posRaf = 0;
  let domRaf = 0;

  function bumpTick(): void {
    cancelAnimationFrame(posRaf);
    posRaf = requestAnimationFrame(() => {
      tick.value++;
    });
  }

  function rebuildMap(): void {
    cancelAnimationFrame(domRaf);
    domRaf = requestAnimationFrame(() => {
      elementMap.value = buildElementMap();
      tick.value++;
    });
  }

  useEventListener(windowWhenActive, "scroll", bumpTick, { capture: true, passive: true });
  useEventListener(windowWhenActive, "resize", bumpTick, { passive: true });
  useMutationObserver(bodyWhenActive, rebuildMap, { childList: true, subtree: true });
  useResizeObserver(bodyWhenActive, bumpTick);

  // Prime on the off→on edge; observers only fire on subsequent mutations.
  watch(
    active,
    (a) => {
      if (a) rebuildMap();
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    cancelAnimationFrame(posRaf);
    cancelAnimationFrame(domRaf);
  });
}
