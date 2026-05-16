// Bridge from a DOM element to its rendering Vue component. Mirrors the
// pattern Vue Devtools uses (`target.__vueParentComponent`) so we work for
// non-component DOM (text nodes, plain divs) by walking up to the nearest
// owning component.

const ATTR = "data-v-inspector";

type Vnode = { el?: Node | null; component?: Instance | null; children?: Vnode[] };

export type Instance = {
  uid?: number;
  type?: { __name?: string; name?: string; __file?: string };
  vnode?: Vnode;
  subTree?: Vnode;
  parent?: Instance | null;
  root?: Instance;
  appContext?: { config?: { globalProperties?: Record<string, unknown> } };
};

export function findInstance(el: Element | null): Instance | null {
  let cur: (Element & { __vueParentComponent?: Instance }) | null = el;
  while (cur) {
    if (cur.__vueParentComponent) return cur.__vueParentComponent;
    cur = cur.parentElement;
  }
  return null;
}

// Returns the chain of owning components from deepest to root, deduping
// repeats (each component appears once even if its subtree spans multiple
// elements that all point at the same instance).
export function ancestorChain(inst: Instance): Instance[] {
  const out: Instance[] = [];
  let cur: Instance | null | undefined = inst;
  while (cur) {
    if (!out.includes(cur)) out.push(cur);
    cur = cur.parent ?? null;
  }
  return out;
}

export function instanceName(inst: Instance | null | undefined): string {
  if (!inst) return "Anonymous";
  const t = inst.type;
  if (t?.__name) return t.__name;
  if (t?.name) return t.name;
  if (t?.__file) {
    const base = t.__file.split("/").pop() ?? t.__file;
    return base.replace(/\.[^.]+$/, "");
  }
  return "Anonymous";
}

// Concrete element this instance currently occupies. For fragments, returns
// null — caller should fall back to the union of child rects.
function rootElement(inst: Instance): HTMLElement | null {
  const el = inst.subTree?.el ?? inst.vnode?.el;
  if (el && (el as HTMLElement).nodeType === 1) return el as HTMLElement;
  return null;
}

// Bounding rect of an instance. Handles fragments by unioning every child
// vnode's rendered rect, matching Vue Devtools' getComponentBoundingRect.
export function instanceRect(inst: Instance): DOMRect | null {
  const direct = rootElement(inst);
  if (direct) return direct.getBoundingClientRect();
  // Fragment: walk subTree children and union their rects.
  const sub = inst.subTree;
  if (!sub?.children) return null;
  return mergeChildRects(sub.children);
}

function mergeChildRects(children: Vnode[]): DOMRect | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let hit = false;
  for (const child of children) {
    const r = vnodeRect(child);
    if (!r) continue;
    hit = true;
    if (r.left < left) left = r.left;
    if (r.top < top) top = r.top;
    if (r.right > right) right = r.right;
    if (r.bottom > bottom) bottom = r.bottom;
  }
  if (!hit) return null;
  return new DOMRect(left, top, right - left, bottom - top);
}

function vnodeRect(v: Vnode): DOMRect | null {
  if (v.component) return instanceRect(v.component);
  const el = v.el;
  if (!el) return null;
  if ((el as HTMLElement).nodeType === 1) {
    return (el as HTMLElement).getBoundingClientRect();
  }
  if ((el as Text).nodeType === 3 && (el as Text).data?.trim()) {
    const range = document.createRange();
    range.selectNode(el);
    return range.getBoundingClientRect();
  }
  return null;
}

// Source location (path:line) for an instance. Tries the instance's own
// root element first, then walks down into its rendered subtree looking for
// any element carrying the build-time `data-v-inspector` attribute. We need
// this because fragment-rooted components don't have a single root element
// to read from, and host-app elements that lack the attr can still belong to
// a parent component whose template was tagged.
export function instanceInspector(inst: Instance): string | null {
  const root = rootElement(inst);
  if (root) {
    const own = root.getAttribute(ATTR);
    if (own) return own;
    const inside = root.querySelector(`[${ATTR}]`);
    if (inside) return inside.getAttribute(ATTR);
  }
  const sub = inst.subTree;
  if (sub?.children) {
    for (const child of sub.children) {
      const found = vnodeInspector(child);
      if (found) return found;
    }
  }
  return null;
}

function vnodeInspector(v: Vnode): string | null {
  if (v.component) return instanceInspector(v.component);
  const el = v.el;
  if (el && (el as HTMLElement).nodeType === 1) {
    const e = el as HTMLElement;
    return e.getAttribute(ATTR) ?? e.querySelector(`[${ATTR}]`)?.getAttribute(ATTR) ?? null;
  }
  return null;
}
