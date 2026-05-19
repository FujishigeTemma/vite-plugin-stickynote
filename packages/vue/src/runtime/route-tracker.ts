import { onScopeDispose, watch } from "vue";

import { hostRouter } from "./host-router.ts";
import { currentRoute, noRouter } from "./state.ts";

type RouteSnap = { fullPath: string; matched: { path: string }[] };

// Defer the "no router" verdict a tick so an `app:init` that races the
// overlay mount still has a chance to populate `hostRouter` first.
const NO_ROUTER_GRACE_MS = 500;

export function useRouteTracker(): void {
  currentRoute.value = pickPath(window.location.pathname);

  let unregister: (() => void) | null = null;

  // `hostRouter` lives in this module's Vue instance, so the watch works
  // even when the host runs a separate Vue copy (pnpm dedup miss). On the
  // bound router we use `afterEach` for the same reason — a plain callback
  // API survives where a cross-Vue reactive `watch` wouldn't.
  const stopWatch = watch(
    hostRouter,
    (router) => {
      unregister?.();
      unregister = null;
      if (!router) return;
      noRouter.value = false;
      apply(router.currentRoute.value);
      unregister = router.afterEach((to) => apply(to));
    },
    { immediate: true },
  );

  const verdict = window.setTimeout(() => {
    if (!hostRouter.value) noRouter.value = true;
  }, NO_ROUTER_GRACE_MS);

  onScopeDispose(() => {
    window.clearTimeout(verdict);
    stopWatch();
    unregister?.();
  });
}

function apply(r: RouteSnap): void {
  // Walk matched deepest-first to skip path-less wrapper / empty-path
  // layout records, so leaf layouts don't collapse the pattern to a less
  // specific parent path.
  for (let i = r.matched.length - 1; i >= 0; i--) {
    const path = r.matched[i]?.path;
    if (path) {
      currentRoute.value = path;
      return;
    }
  }
  currentRoute.value = pickPath(r.fullPath);
}

function pickPath(input: string): string {
  return input.split(/[?#]/, 1)[0]!;
}
