import { useMutationObserver } from "@vueuse/core";
import { computed, onScopeDispose, watch } from "vue";

import { active, domVersion } from "./state.ts";

// Bumps `domVersion` when the host DOM gains or loses an inspector-tagged
// element — the only event that can change which element a stored
// (path, line, index) resolves to. Position follow-through is handled by
// CSS `anchor()` in the browser, so no scroll / resize / per-element rect
// listeners are needed here.
const INSPECTOR_SELECTOR = "[data-v-inspector]";

function touchesInspector(node: Node): boolean {
  if (node.nodeType !== 1) return false;
  const el = node as Element;
  return el.matches?.(INSPECTOR_SELECTOR) || el.querySelector?.(INSPECTOR_SELECTOR) !== null;
}

function relevant(records: MutationRecord[]): boolean {
  for (const r of records) {
    const target = r.target as Element;
    // Skip mutations originating inside the overlay (own selection / hover
    // updates would otherwise feed back here).
    if (target.nodeType === 1 && target.closest("[data-stickynote-ignore]")) continue;
    for (const n of r.addedNodes) if (touchesInspector(n)) return true;
    for (const n of r.removedNodes) if (touchesInspector(n)) return true;
  }
  return false;
}

export function useDomTracker(): void {
  const bodyWhenActive = computed(() => (active.value ? document.body : undefined));

  let raf = 0;
  function bump(): void {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      domVersion.value++;
    });
  }

  useMutationObserver(
    bodyWhenActive,
    (records) => {
      if (relevant(records)) bump();
    },
    { childList: true, subtree: true },
  );

  watch(
    active,
    (a) => {
      if (a) bump();
    },
    { immediate: true },
  );

  onScopeDispose(() => cancelAnimationFrame(raf));
}
