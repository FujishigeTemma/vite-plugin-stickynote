import { queryOptions } from "@tanstack/react-query";

import { getAPIClient } from "../api-client.ts";

// Query option factories. Unlike the Vue version's `MaybeRefOrGetter`-based
// reactive keys, React Query keys are plain values and reactivity comes
// from the hook re-rendering with new args. Callers pass current store
// values directly.

export const serverQueries = {
  me: () =>
    queryOptions({
      queryKey: ["sn", "me"] as const,
      queryFn: async () => {
        const res = await getAPIClient().api.me.$get();
        if (!res.ok) return null;
        return await res.json();
      },
      staleTime: Number.POSITIVE_INFINITY,
    }),

  threads: {
    all: ["sn", "threads"] as const,

    list: (route: string, includeResolved: boolean) =>
      queryOptions({
        queryKey: ["sn", "threads", "list", route, includeResolved] as const,
        queryFn: async () => {
          const query: { route?: string; includeResolved?: "true" } = { route };
          if (includeResolved) query.includeResolved = "true";
          const res = await getAPIClient().api.threads.$get({ query });
          if (!res.ok) throw new Error(`GET /api/threads → ${res.status}`);
          return (await res.json()).threads;
        },
      }),

    detail: (threadId: string | null) =>
      queryOptions({
        queryKey: ["sn", "threads", "detail", threadId] as const,
        queryFn: async () => {
          // `enabled` gates this, so threadId is non-null when the query runs.
          const id = threadId as string;
          const res = await getAPIClient().api.threads[":threadId"].$get({
            param: { threadId: id },
          });
          if (!res.ok) throw new Error(`GET /api/threads/${id} → ${res.status}`);
          return await res.json();
        },
        enabled: threadId != null,
      }),

    comments: {
      list: (threadId: string | null) =>
        queryOptions({
          queryKey: ["sn", "threads", "detail", threadId, "comments", "list"] as const,
          queryFn: async () => {
            const id = threadId as string;
            const res = await getAPIClient().api.threads[":threadId"].comments.$get({
              param: { threadId: id },
            });
            if (!res.ok) throw new Error(`GET /api/threads/${id}/comments → ${res.status}`);
            return (await res.json()).comments;
          },
          enabled: threadId != null,
        }),
    },
  },
};
