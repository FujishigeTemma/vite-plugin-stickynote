import { useQuery } from "@tanstack/vue-query";
import { computed, type ComputedRef, type Ref } from "vue";

import { isThreadStale } from "./inspector.ts";
import { serverQueries } from "./queries/server.ts";
import { queryClient } from "./query-client.ts";
import { active, currentRoute, domVersion, showResolved } from "./state.ts";
import type { Thread } from "./types.ts";

// Composes UI gates (active, currentRoute, showResolved) with the threads
// server query plus the polling/disable policy. Replaces the old store's
// `visibleThreads` + `refreshThreads` + 5 s setInterval.
export function useThreadsList(): {
  threads: ComputedRef<Thread[]>;
  visible: ComputedRef<Thread[]>;
  isLoading: Ref<boolean>;
} {
  const q = useQuery(
    {
      ...serverQueries.threads.list(
        () => currentRoute.value,
        () => showResolved.value,
      ),
      enabled: () => active.value,
      refetchInterval: () => (active.value ? 5000 : false),
    },
    queryClient,
  );

  const threads = computed(() => q.data.value ?? []);
  const visible = computed(() =>
    showResolved.value ? threads.value : threads.value.filter((t) => t.status === "open"),
  );
  return { threads, visible, isLoading: q.isLoading };
}

// Recomputed when threads change or the host DOM gains/loses inspector-
// tagged elements. Centralises the `domVersion` dependency so callers don't
// need to subscribe themselves, and runs `isThreadStale` (a `querySelector`
// per thread) once per bump rather than once per consumer per row.
export function useStaleThreads(source: ComputedRef<Thread[]>): {
  stale: ComputedRef<Thread[]>;
  isStale: (t: Thread) => boolean;
} {
  const staleIds = computed<Set<string>>(() => {
    void domVersion.value;
    return new Set(source.value.filter((t) => isThreadStale(t)).map((t) => t.id));
  });
  return {
    stale: computed(() => source.value.filter((t) => staleIds.value.has(t.id))),
    isStale: (t: Thread): boolean => staleIds.value.has(t.id),
  };
}
