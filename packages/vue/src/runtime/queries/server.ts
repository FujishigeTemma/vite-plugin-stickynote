import { queryOptions } from "@tanstack/vue-query";
import { type MaybeRefOrGetter, toValue } from "vue";

import { getAPIClient } from "../api-client.ts";
import type { Me } from "../types.ts";

export const serverQueries = {
  me: () =>
    queryOptions({
      queryKey: ["sn", "me"] as const,
      queryFn: async (): Promise<Me | null> => {
        const res = await getAPIClient().api.me.$get();
        if (!res.ok) return null;
        return (await res.json()) as Me;
      },
      staleTime: Number.POSITIVE_INFINITY,
    }),

  threads: {
    all: ["sn", "threads"] as const,
    list: (route: MaybeRefOrGetter<string>, includeResolved: MaybeRefOrGetter<boolean>) =>
      queryOptions({
        queryKey: ["sn", "threads", "list", route, includeResolved] as const,
        queryFn: async () => {
          const query: { route?: string; includeResolved?: "true" } = {
            route: toValue(route),
          };
          if (toValue(includeResolved)) query.includeResolved = "true";
          const res = await getAPIClient().api.threads.$get({ query });
          if (!res.ok) throw new Error(`GET /api/threads → ${res.status}`);
          return (await res.json()).threads;
        },
      }),
  },

  comments: {
    all: ["sn", "comments"] as const,
    list: (threadId: MaybeRefOrGetter<string | null>) =>
      queryOptions({
        queryKey: ["sn", "comments", "list", threadId] as const,
        queryFn: async () => {
          const id = toValue(threadId);
          if (!id) return [];
          const res = await getAPIClient().api.threads[":id"].comments.$get({
            param: { id },
          });
          if (!res.ok) throw new Error(`GET /api/threads/${id}/comments → ${res.status}`);
          return (await res.json()).comments;
        },
        enabled: () => toValue(threadId) != null,
      }),
  },
};
