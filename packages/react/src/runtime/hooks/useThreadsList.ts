import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { isThreadStale } from "../inspector.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";
import { useStore } from "../store.ts";
import type { Thread } from "../types.ts";

// Composes UI gates (active, currentRoute, showResolved) with the threads
// server query plus the polling/disable policy. Mirrors the Vue
// `useThreadsList` composable's shape: `threads` (all), `visible` (filtered
// by showResolved), and `isLoading`.
export function useThreadsList(): {
  threads: Thread[];
  visible: Thread[];
  isLoading: boolean;
} {
  const active = useStore((s) => s.active);
  const currentRoute = useStore((s) => s.currentRoute);
  const showResolved = useStore((s) => s.showResolved);

  const q = useQuery(
    {
      ...serverQueries.threads.list(currentRoute, showResolved),
      enabled: active,
      refetchInterval: active ? 5000 : false,
    },
    queryClient,
  );

  const threads = useMemo(() => q.data ?? [], [q.data]);
  const visible = useMemo(
    () => (showResolved ? threads : threads.filter((t) => t.status === "open")),
    [threads, showResolved],
  );
  return { threads, visible, isLoading: q.isLoading };
}

// Recomputed when threads change or the host DOM gains/loses inspector-
// tagged elements. Centralises the `domVersion` dependency so callers
// don't need to subscribe themselves, and runs `isThreadStale` (a
// `querySelector` per thread) once per bump rather than once per consumer
// per row.
export function useStaleThreads(source: Thread[]): {
  stale: Thread[];
  isStale: (t: Thread) => boolean;
} {
  const domVersion = useStore((s) => s.domVersion);
  const staleIds = useMemo<Set<string>>(() => {
    void domVersion;
    return new Set(source.filter((t) => isThreadStale(t)).map((t) => t.id));
  }, [source, domVersion]);

  return {
    stale: useMemo(() => source.filter((t) => staleIds.has(t.id)), [source, staleIds]),
    isStale: (t: Thread): boolean => staleIds.has(t.id),
  };
}
