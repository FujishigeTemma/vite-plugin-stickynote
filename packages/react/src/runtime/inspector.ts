// Locate the React component for a DOM element via the
// `data-react-inspector` attribute injected by inspector-transform.ts at
// build time. The attribute is the only source of truth — we deliberately
// don't depend on React internals or `_debugStack` because the attribute
// survives any build mode while React's own debug fields are dev-only.

import { getReactComponentName } from "./react-instance.ts";
import type { Component, Thread } from "./types.ts";

// Identity for a component occurrence in the DOM: same JSX site + same
// list-index iteration. Used as map/list/React keys and for equality
// checks. `v_for_index` retains its Vue-era name on the wire (it's part
// of the worker's persistence schema); for React it just means
// "document-order occurrence index among elements sharing this path:line".
export type ComponentKeyParts = Pick<Component, "path" | "line" | "v_for_index">;

export function componentKey(c: ComponentKeyParts): string {
  return `${c.path}:${c.line}#${c.v_for_index}`;
}

// CSS custom-ident form of the component key — paths and `:` / `#` aren't
// legal in `anchor-name` values, so non-ident chars collapse to `_`.
export function componentAnchorName(c: ComponentKeyParts): string {
  return `--sn-sel-${componentKey(c).replaceAll(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function sameComponent(a: ComponentKeyParts, b: ComponentKeyParts): boolean {
  return componentKey(a) === componentKey(b);
}

const ATTR = "data-react-inspector";
const SELECTOR = `[${ATTR}]`;

export type InspectorInfo = {
  raw: string;
  path: string;
  line: number;
};

export function getInspectorData(el: Element | null): string | null {
  return el?.getAttribute(ATTR) ?? null;
}

export function parseInspector(raw: string | null): InspectorInfo | null {
  if (!raw) return null;
  const m = /^(.+):(\d+)$/.exec(raw);
  if (!m) return null;
  return {
    raw,
    path: m[1] as string,
    line: Number(m[2]),
  };
}

// Nearest enclosing inspector-tagged ancestor for any element (including
// text nodes' parents and bare HTML). Returns null if no inspector-tagged
// ancestor exists.
export function nearestComponentRoot(el: Element | null): Element | null {
  return el?.closest(SELECTOR) ?? null;
}

// All inspector-tagged ancestors, innermost first. Used to build the
// Alt+ArrowUp/Down stepwise navigation chain — every step is a concrete
// `path:line` site that can be pinned, including bare `<div>`s.
export function ancestorsWithInspector(start: Element): Element[] {
  const out: Element[] = [];
  let el: Element | null = start.closest(SELECTOR);
  while (el) {
    out.push(el);
    el = el.parentElement?.closest(SELECTOR) ?? null;
  }
  return out;
}

// Default depth in the `chain` for `cursorEl`: the index of the nearest
// inspector-tagged ancestor (i.e., the innermost). Alt+Down drills deeper
// (into nested intrinsics); Alt+Up climbs to outer ancestors. For React
// this is simply 0 — the inspector transform only tags intrinsic elements,
// so the "owning component root" isn't a distinct concept the way it was
// for Vue. Keep the signature for API parity.
export function defaultDepthFor(_cursorEl: Element, _chain: Element[]): number {
  return 0;
}

// Component display name for an element. For React we delegate to the
// fiber-walking helper so users see "Counter" rather than "button" when
// they hover the innermost intrinsic inside a custom component.
export function elementDisplayName(el: Element): string {
  return getReactComponentName(el);
}

// When a component renders N times (lists), file:line is not unique.
// Record the document-order index among matches so we can re-find it.
export function findOccurrenceIndex(target: Element, data: string): number {
  const all = document.querySelectorAll(`[${ATTR}="${CSS.escape(data)}"]`);
  for (let i = 0; i < all.length; i++) {
    if (all[i] === target) return i;
  }
  return 0;
}

// The one and only way to resolve a persisted (path, line, index) tuple
// back to a live DOM element. Lookups are rare (per-pin, on dom-version
// bump), so an indexed cache buys nothing over a direct attribute query.
export function findComponentElement(path: string, line: number, index: number): Element | null {
  const list = document.querySelectorAll(`[${ATTR}="${CSS.escape(`${path}:${line}`)}"]`);
  return list[index] ?? null;
}

export function isThreadStale(thread: Thread): boolean {
  if (thread.components.length === 0) return false;
  const primary = thread.components[0];
  if (!primary) return false;
  return findComponentElement(primary.path, primary.line, primary.v_for_index) == null;
}

export function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function buildGithubUrl(
  repo: string | null,
  commitHash: string,
  path: string | null,
  line: number | null,
): string | null {
  if (!repo || !path) return null;
  if (!commitHash || commitHash === "unknown") return null;
  const lineFragment = line ? `#L${line}` : "";
  return `https://github.com/${repo}/blob/${commitHash}/${path}${lineFragment}`;
}
