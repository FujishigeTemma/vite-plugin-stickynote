// Bridge from a DOM element to its rendering React component name. React
// does not publicly expose this, but the `__reactFiber$<rendererID>`
// property key has been stable since React 16 and works in both dev and
// production builds. We deliberately avoid `__REACT_DEVTOOLS_GLOBAL_HOOK__`:
// it requires patching the reconciler at boot, which an externally
// injected overlay cannot do (`react-devtools-shared/src/backend/fiber/
// renderer.js` populates its DOM→fiber WeakMap from inside the renderer).
//
// The unwrap logic mirrors what React DevTools' `getDisplayNameForFiber`
// (`renderer.js:5296-5327`) does internally — function name, memo target,
// forwardRef render fn, displayName overrides.

type Fiber = {
  type?: unknown;
  return?: Fiber | null;
};

type FunctionLike = {
  displayName?: string;
  name?: string;
};

type WrappedLike = {
  displayName?: string;
  // `memo(Foo)` → `type.type` is the wrapped component (function or another wrapper).
  type?: unknown;
  // `forwardRef((props, ref) => …)` → `type.render` is the render function.
  render?: unknown;
};

function getFiber(el: Element): Fiber | null {
  for (const key of Object.keys(el)) {
    if (key.startsWith("__reactFiber$")) {
      return (el as unknown as Record<string, Fiber | null>)[key] ?? null;
    }
  }
  return null;
}

function nameFromType(t: unknown): string | null {
  if (typeof t === "function") {
    const fn = t as FunctionLike;
    return fn.displayName || fn.name || null;
  }
  if (typeof t === "object" && t !== null) {
    const w = t as WrappedLike;
    if (typeof w.displayName === "string" && w.displayName.length > 0) return w.displayName;
    if (w.render) {
      const inner = nameFromType(w.render);
      return inner ? `ForwardRef(${inner})` : "ForwardRef";
    }
    if (w.type) {
      const inner = nameFromType(w.type);
      return inner ? `Memo(${inner})` : "Memo";
    }
  }
  return null;
}

// Nearest owning component's display name. Falls back to the element's
// tag name so callers always get a sensible string.
export function getReactComponentName(el: Element): string {
  const fallback = el.tagName.toLowerCase();
  let fiber = getFiber(el);
  while (fiber) {
    const name = nameFromType(fiber.type);
    if (name) return name;
    fiber = fiber.return ?? null;
  }
  return fallback;
}
