import { useEffect, useRef, useState } from "react";

import { findComponentElement, type ComponentKeyParts } from "./inspector.ts";
import { useStore } from "./store.ts";

// CSS Anchor Positioning binding: resolves a (path, line, index) tuple to a
// live host element and stamps `anchor-name` on it. Pins, hover, and
// selection boxes all anchor off these names; the browser handles every
// position update via `anchor()` / `anchor-size()`.

const ANCHOR_PROP = "anchor-name";

// `anchor-name` accepts a comma-separated list of `<dashed-ident>`. Pin,
// hover, and selection all anchor off the same component-root element, so
// stamping must be additive — overwriting would let one consumer clobber the
// others and send their overlays to the (0, 0) fallback.
function readNames(el: HTMLElement): string[] {
  const raw = el.style.getPropertyValue(ANCHOR_PROP);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "none");
}

function writeNames(el: HTMLElement, names: string[]): void {
  if (names.length === 0) el.style.removeProperty(ANCHOR_PROP);
  else el.style.setProperty(ANCHOR_PROP, names.join(", "));
}

export function stampAnchor(el: HTMLElement, name: string): void {
  const names = readNames(el);
  if (names.includes(name)) return;
  names.push(name);
  writeNames(el, names);
}

export function clearAnchor(el: HTMLElement | null, name: string): void {
  if (!el) return;
  const names = readNames(el);
  const i = names.indexOf(name);
  if (i < 0) return;
  names.splice(i, 1);
  writeNames(el, names);
}

// Resolve a component identity to a live DOM element and stamp the given
// CSS anchor name on it. Tracks `domVersion` so reflows / re-renders that
// change the matched element are picked up. Returns the bound element via
// a state ref so consumers can conditionally render based on its presence.
export function useAnchorBinding(
  component: ComponentKeyParts | null,
  anchorName: string,
): { element: Element | null } {
  const [element, setElement] = useState<Element | null>(null);
  const boundRef = useRef<HTMLElement | null>(null);
  const domVersion = useStore((s) => s.domVersion);

  useEffect(() => {
    const next = component
      ? (findComponentElement(
          component.path,
          component.line,
          component.v_for_index,
        ) as HTMLElement | null)
      : null;
    if (next === boundRef.current) return;
    clearAnchor(boundRef.current, anchorName);
    if (next) stampAnchor(next, anchorName);
    boundRef.current = next;
    setElement(next);
  }, [anchorName, component?.path, component?.line, component?.v_for_index, domVersion, component]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      clearAnchor(boundRef.current, anchorName);
      boundRef.current = null;
    };
  }, [anchorName]);

  return { element };
}
