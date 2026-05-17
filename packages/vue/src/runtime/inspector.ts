// Locate the Vue component for a DOM element via the `data-v-inspector`
// attribute injected by vite-plugin-vue-inspector. The plugin is configured
// with cleanHtml:false so every component root carries the attribute on the
// rendered DOM — no Vue private API access needed.

import type { Component, Thread } from "./types.ts";

// Identity for a component occurrence in the DOM: same template site +
// same v-for iteration. Used as map/list/Vue keys and for equality checks.
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

const ATTR = "data-v-inspector";
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

// Nearest enclosing component root for any element (including text nodes'
// parents and bare HTML). Returns null if no inspector-tagged ancestor exists.
export function nearestComponentRoot(el: Element | null): Element | null {
  return el?.closest(SELECTOR) ?? null;
}

// All component-root ancestors, deepest first. Used by Alt-key parent walk.
export function ancestorsWithInspector(start: Element): Element[] {
  const out: Element[] = [];
  let el: Element | null = start.closest(SELECTOR);
  while (el) {
    out.push(el);
    el = el.parentElement?.closest(SELECTOR) ?? null;
  }
  return out;
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

// The one and only way to resolve a persisted (path, line, index) tuple back
// to a live DOM element. Lookups are rare (per-pin, on dom-version bump), so
// an indexed cache buys nothing over a direct attribute query.
export function findComponentElement(path: string, line: number, index: number): Element | null {
  const list = document.querySelectorAll(`[${ATTR}="${CSS.escape(`${path}:${line}`)}"]`);
  return list[index] ?? null;
}

// Locate the element carrying the exact `data-v-inspector` value at or below
// `start`. Used when a Vue instance's root element is a wrapper that itself
// lacks the attribute (e.g. component picked through __vueParentComponent).
export function findInspectorDescendant(start: Element | null, data: string): Element | null {
  if (!start) return null;
  if (start.getAttribute?.(ATTR) === data) return start;
  return start.querySelector?.(`[${ATTR}="${CSS.escape(data)}"]`) ?? null;
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
