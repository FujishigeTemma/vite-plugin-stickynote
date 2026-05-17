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
  // Filter out mutations inside the plugin's own overlay — otherwise our
  // selection-highlight / hover-card updates feed back here, bump tick, which
  // re-renders the overlay, which mutates the DOM again, ad infinitum.
  useMutationObserver(
    bodyWhenActive,
    (records) => {
      for (const r of records) {
        const target = r.target as Element;
        if (target.nodeType === 1 && target.closest("[data-stickynote-ignore]")) continue;
        rebuildMap();
        return;
      }
    },
    { childList: true, subtree: true },
  );
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
