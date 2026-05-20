import { useEffect } from "react";

import { useStore } from "./store.ts";

// Bumps `domVersion` when the host DOM gains or loses an inspector-tagged
// element — the only event that can change which element a stored
// (path, line, index) resolves to. Position follow-through is handled by
// CSS `anchor()` in the browser, so no scroll / resize / per-element rect
// listeners are needed here.
const INSPECTOR_SELECTOR = "[data-react-inspector]";

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
  const active = useStore((s) => s.active);
  const bumpDomVersion = useStore((s) => s.bumpDomVersion);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const bump = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => bumpDomVersion());
    };
    const observer = new MutationObserver((records) => {
      if (relevant(records)) bump();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [active, bumpDomVersion]);
}
