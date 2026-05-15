// Locate the Vue component for a DOM element via the `data-v-inspector`
// attribute injected by vite-plugin-vue-inspector. The plugin is configured
// with cleanHtml:false so every component root carries the attribute on the
// rendered DOM — no Vue private API access needed.

import type { Thread } from "./types.ts";

const ATTR = "data-v-inspector";
const SELECTOR = `[${ATTR}]`;

export type InspectorInfo = {
  raw: string;
  path: string;
  line: number;
  column: number;
};

export function getInspectorData(el: Element | null): string | null {
  return el?.getAttribute(ATTR) ?? null;
}

export function parseInspector(raw: string | null): InspectorInfo | null {
  if (!raw) return null;
  const m = /^(.+):(\d+):(\d+)$/.exec(raw);
  if (!m) return null;
  return {
    raw,
    path: m[1] as string,
    line: Number(m[2]),
    column: Number(m[3]),
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
  // Attribute-value selector. data is "path:line:col" — safe to embed via
  // CSS.escape since paths can contain characters that need quoting.
  const all = document.querySelectorAll(`[${ATTR}="${CSS.escape(data)}"]`);
  for (let i = 0; i < all.length; i++) {
    if (all[i] === target) return i;
  }
  return 0;
}

// Map from "path:line" → component-root elements in document order. Built
// once per DOM-change tick so pins can look up their anchor without a fresh
// tree walk each time.
export type ElementMap = Map<string, Element[]>;

export function buildElementMap(): ElementMap {
  const map: ElementMap = new Map();
  const all = document.querySelectorAll(SELECTOR);
  for (const el of all) {
    const raw = el.getAttribute(ATTR);
    if (!raw) continue;
    // Drop the column from "path:line:col" — pins identify by path:line.
    const lastColon = raw.lastIndexOf(":");
    const key = lastColon === -1 ? raw : raw.slice(0, lastColon);
    const list = map.get(key);
    if (list) list.push(el);
    else map.set(key, [el]);
  }
  return map;
}

export function findElementInMap(
  map: ElementMap,
  path: string,
  line: number,
  index: number,
): Element | null {
  const matches = map.get(`${path}:${line}`);
  if (!matches || matches.length === 0) return null;
  return matches[index] ?? matches[0] ?? null;
}

export function isThreadStale(thread: Thread, elementMap: ElementMap): boolean {
  if (thread.component_path == null || thread.component_line == null) return false;
  return (
    findElementInMap(
      elementMap,
      thread.component_path,
      thread.component_line,
      thread.component_index,
    ) == null
  );
}

export function componentName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.[^.]+$/, "");
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
