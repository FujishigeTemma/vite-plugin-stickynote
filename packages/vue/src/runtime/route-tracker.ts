import { useEventListener } from "@vueuse/core";
import { onScopeDispose, watch } from "vue";

import { hostRouter } from "./host-router.ts";
import { currentRoute } from "./state.ts";

type RouteSnap = { fullPath: string; matched: { path: string }[] };

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
      apply(router.currentRoute.value);
      unregister = router.afterEach((to) => apply(to));
    },
    { immediate: true },
  );

  // Fallback for no-router hosts. pushState navigations aren't covered,
  // but there's no meaningful route pattern to mirror in that case.
  useEventListener(window, "popstate", () => {
    if (unregister) return;
    currentRoute.value = pickPath(window.location.pathname);
  });

  onScopeDispose(() => {
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
