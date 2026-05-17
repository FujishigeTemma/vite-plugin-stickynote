import { useQuery } from "@tanstack/vue-query";
import { computed, type ComputedRef, type Ref } from "vue";

import { serverQueries } from "./queries/server.ts";
import { queryClient } from "./query-client.ts";
import { active, currentRoute, showResolved } from "./state.ts";
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
