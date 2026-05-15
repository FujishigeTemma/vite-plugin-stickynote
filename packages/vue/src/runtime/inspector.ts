// DOM-side helpers for finding the Vue component under a point and reading
// its source location. Mirrors vite-plugin-vue-inspector's lookup so results
// stay consistent across hover-highlight and pin-restore.

const KEY_DATA_ATTR = "data-v-inspector";
const KEY_PROPS = "__v_inspector";

type ElWithVnode = Element & {
  __vnode?: {
    props?: Record<string | symbol, unknown>;
    ctx?: { vnode?: { props?: Record<string | symbol, unknown>; el?: Node } };
  };
  __vueParentComponent?: { vnode?: { el?: Node } };
};

export type InspectorInfo = {
  // "src/components/HeroCard.vue:6:3"
  raw: string;
  path: string;
  line: number;
  column: number;
};

export function getInspectorData(el: Element | null): string | null {
  if (!el) return null;
  const e = el as ElWithVnode;
  const direct = e.__vnode?.props?.[KEY_PROPS];
  if (typeof direct === "string") return direct;
  const ctx = e.__vnode?.ctx?.vnode;
  if (ctx?.el === el) {
    const v = ctx.props?.[KEY_PROPS];
    if (typeof v === "string") return v;
  }
  return e.getAttribute?.(KEY_DATA_ATTR) ?? null;
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

// Walk up DOM ancestors and return all elements that carry inspector data.
// The first entry is the deepest component; index N moves up the tree.
export function ancestorsWithInspector(start: Element): Element[] {
  const out: Element[] = [];
  let el: Element | null = start;
  while (el && el !== document.documentElement) {
    if (getInspectorData(el)) out.push(el);
    el = el.parentElement;
  }
  return out;
}

// Fallback for non-Vue elements: walk up Vue's component tree until we
// find a component-root DOM element.
export function fallbackToVueParent(el: Element | null): Element | null {
  if (!el) return null;
  if (getInspectorData(el)) return el;
  let inst = (el as ElWithVnode).__vueParentComponent;
  while (inst) {
    const root = inst.vnode?.el;
    if (root instanceof Element && getInspectorData(root)) return root;
    inst = (inst as { parent?: typeof inst }).parent;
  }
  return null;
}

// When a component is rendered N times (lists, etc.), file:line is not
// unique. Add the document-order index of the matched element among
// siblings with the same inspector data so we can re-find it later.
export function findOccurrenceIndex(target: Element, data: string): number {
  let idx = -1;
  let count = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    const el = node as Element;
    if (getInspectorData(el) === data) {
      if (el === target) idx = count;
      count++;
    }
    node = walker.nextNode();
  }
  return idx === -1 ? 0 : idx;
}

import type { Thread } from "./types.ts";

// Map from "path:line" → all matching DOM elements in document order.
// Built once per tick by the overlay cache; pins/lists look up by key.
export type ElementMap = Map<string, Element[]>;

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

// A thread is stale when its anchor component is no longer in the DOM.
// Page-wide threads (no path/line) can never be stale.
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

// Friendly component name from a path: "src/components/HeroCard.vue" → "HeroCard"
export function componentName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.[^.]+$/, "");
}

// Build a link to GitHub blob view for a thread. Returns null when we don't
// have enough information (no repo configured, or commit unknown).
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
