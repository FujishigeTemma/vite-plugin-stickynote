import { useEventListener } from "@vueuse/core";
import { watch } from "vue";

import { currentRoute } from "./state.ts";
import { findInstance } from "./vue-instance.ts";

type RouterLike = {
  currentRoute: { value: { fullPath: string; matched: { path: string }[] } };
};

// Prefer the host's vue-router so we get route patterns ("/users/:id") rather
// than concrete URLs. Falls back to popstate when no router is installed;
// don't monkey-patch history.pushState.
export function useRouteTracker(): void {
  const router = findHostRouter();
  if (router) {
    watch(
      () => router.currentRoute.value,
      (r) => {
        const matched = r.matched[r.matched.length - 1];
        currentRoute.value = matched?.path ?? r.fullPath;
      },
      { immediate: true },
    );
    return;
  }
  useEventListener(window, "popstate", () => {
    currentRoute.value = window.location.pathname;
  });
}

function findHostRouter(): RouterLike | null {
  const anchor = document.querySelector("[data-v-inspector]");
  if (!anchor) return null;
  const inst = findInstance(anchor);
  const router = inst?.appContext?.config?.globalProperties?.$router;
  return (router as RouterLike | undefined) ?? null;
}
