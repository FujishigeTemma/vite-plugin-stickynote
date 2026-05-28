import { queryOptions } from "@tanstack/vue-query";
import { type MaybeRefOrGetter, toValue } from "vue";

import { getAPIClient } from "../api-client.ts";

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

    list: (
      route: MaybeRefOrGetter<string | undefined>,
      includeResolved: MaybeRefOrGetter<boolean>,
      q?: MaybeRefOrGetter<string | undefined>,
    ) =>
      queryOptions({
        queryKey: ["sn", "threads", "list", route, includeResolved, q] as const,
        queryFn: async () => {
          const query: { route?: string; includeResolved?: "true"; q?: string } = {};
          const r = toValue(route);
          if (r) query.route = r;
          if (toValue(includeResolved)) query.includeResolved = "true";
          const search = toValue(q)?.trim();
          if (search) query.q = search;
          const res = await getAPIClient().api.threads.$get({ query });
          if (!res.ok) throw new Error(`GET /api/threads → ${res.status}`);
          return (await res.json()).threads;
        },
      }),

    detail: (threadId: MaybeRefOrGetter<string | null>) =>
      queryOptions({
        queryKey: ["sn", "threads", "detail", threadId] as const,
        queryFn: async () => {
          // `enabled` gates this, so threadId is non-null when the query runs.
          const id = toValue(threadId) as string;
          const res = await getAPIClient().api.threads[":threadId"].$get({
            param: { threadId: id },
          });
          if (!res.ok) throw new Error(`GET /api/threads/${id} → ${res.status}`);
          return await res.json();
        },
        enabled: () => toValue(threadId) != null,
      }),

    comments: {
      list: (threadId: MaybeRefOrGetter<string | null>) =>
        queryOptions({
          queryKey: ["sn", "threads", "detail", threadId, "comments", "list"] as const,
          queryFn: async () => {
            const id = toValue(threadId) as string;
            const res = await getAPIClient().api.threads[":threadId"].comments.$get({
              param: { threadId: id },
            });
            if (!res.ok) throw new Error(`GET /api/threads/${id}/comments → ${res.status}`);
            return (await res.json()).comments;
          },
          enabled: () => toValue(threadId) != null,
        }),
    },
  },

  agentToken: () =>
    queryOptions({
      queryKey: ["sn", "agent-token"] as const,
      queryFn: async () => {
        const res = await getAPIClient().api["agent-token"].$get();
        if (!res.ok) throw new Error(`GET /api/agent-token → ${res.status}`);
        return await res.json();
      },
      staleTime: Number.POSITIVE_INFINITY,
    }),
};
