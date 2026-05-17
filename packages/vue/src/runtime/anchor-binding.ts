import { onScopeDispose, shallowRef, watch, type Ref } from "vue";

import { findComponentElement, type ComponentKeyParts } from "./inspector.ts";
import { domVersion } from "./state.ts";

// CSS Anchor Positioning binding: resolves a (path, line, index) tuple to a
// live host element and stamps `anchor-name` on it. Pins, hover, and
// selection boxes all anchor off these names; the browser handles every
// position update via `anchor()` / `anchor-size()`.

const ANCHOR_PROP = "anchor-name";

// Identity-guarded so a release can't clear a name a later binding already
// wrote onto the same element.
export function stampAnchor(el: HTMLElement, name: string): void {
  el.style.setProperty(ANCHOR_PROP, name);
}

export function clearAnchor(el: HTMLElement | null, name: string): void {
  if (!el) return;
  if (el.style.getPropertyValue(ANCHOR_PROP) === name) {
    el.style.removeProperty(ANCHOR_PROP);
  }
}

export function useAnchorBinding(
  getComponent: () => ComponentKeyParts | null,
  anchorName: string,
): { element: Ref<Element | null> } {
  const element = shallowRef<Element | null>(null);
  let bound: HTMLElement | null = null;

  function rebind(): void {
    const c = getComponent();
    const next = c
      ? (findComponentElement(c.path, c.line, c.v_for_index) as HTMLElement | null)
      : null;
    if (next === bound) return;
    clearAnchor(bound, anchorName);
    if (next) stampAnchor(next, anchorName);
    bound = next;
    element.value = next;
  }

  watch([domVersion, getComponent], rebind, { immediate: true });
  onScopeDispose(() => clearAnchor(bound, anchorName));

  return { element };
}
