// Bridge from a DOM element to its rendering Vue component. Mirrors the
// pattern Vue Devtools uses (`target.__vueParentComponent`) so we work for
// non-component DOM (text nodes, plain divs) by walking up to the nearest
// owning component.

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
export function rootElement(inst: Instance): HTMLElement | null {
  const el = inst.subTree?.el ?? inst.vnode?.el;
  return el instanceof HTMLElement ? el : null;
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
