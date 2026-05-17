import { getAPIClient } from "./api-client.ts";
import { serverQueries } from "./queries/server.ts";
import { queryClient } from "./query-client.ts";
import { currentRoute, openThreadId } from "./state.ts";
import type { Comment, CreateThreadInput, Thread } from "./types.ts";

export const serverMutations = {
  threads: {
    create: () => ({
      mutationFn: async (input: Omit<CreateThreadInput, "route" | "url">) => {
        const res = await getAPIClient().api.threads.$post({
          json: { ...input, route: currentRoute.value, url: window.location.href },
        });
        if (!res.ok) throw new Error(`POST /api/threads → ${res.status}`);
        return (await res.json()) as { thread: Thread; comments: Comment[] };
      },
      onSuccess: ({ thread, comments }: { thread: Thread; comments: Comment[] }) => {
        queryClient.setQueryData(serverQueries.comments.list(thread.id).queryKey, comments);
        void queryClient.invalidateQueries({ queryKey: serverQueries.threads.all });
      },
    }),

    setStatus: () => ({
      mutationFn: async (vars: { id: string; status: "open" | "resolved" }) => {
        const res = await getAPIClient().api.threads[":id"].status.$patch({
          param: { id: vars.id },
          json: { status: vars.status },
        });
        if (!res.ok) throw new Error(`PATCH /api/threads/${vars.id}/status → ${res.status}`);
        return ((await res.json()).thread ?? null) as Thread | null;
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: serverQueries.threads.all });
      },
    }),

    // Optimistic: pin tracks the cursor on drop, so the in-flight window must
    // not snap it back. Snapshot every threads-list cache entry, mutate them,
    // replay on error, then invalidate to reconcile.
    updatePosition: () => ({
      mutationFn: async (vars: { id: string; x_ratio: number; y_ratio: number }) => {
        const res = await getAPIClient().api.threads[":id"].position.$patch({
          param: { id: vars.id },
          json: { x_ratio: vars.x_ratio, y_ratio: vars.y_ratio },
        });
        if (!res.ok) throw new Error(`PATCH /api/threads/${vars.id}/position → ${res.status}`);
        return ((await res.json()).thread ?? null) as Thread | null;
      },
      onMutate: async (vars: { id: string; x_ratio: number; y_ratio: number }) => {
        await queryClient.cancelQueries({ queryKey: serverQueries.threads.all });
        const prev = queryClient.getQueriesData<Thread[]>({
          queryKey: serverQueries.threads.all,
        });
        queryClient.setQueriesData<Thread[]>({ queryKey: serverQueries.threads.all }, (list) =>
          list?.map((t) =>
            t.id === vars.id ? { ...t, x_ratio: vars.x_ratio, y_ratio: vars.y_ratio } : t,
          ),
        );
        return { prev };
      },
      onError: (
        _e: unknown,
        _vars: unknown,
        ctx: { prev: Array<[readonly unknown[], Thread[] | undefined]> } | undefined,
      ) => {
        ctx?.prev?.forEach(([k, d]) => queryClient.setQueryData(k, d));
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: serverQueries.threads.all });
      },
    }),

    delete: () => ({
      mutationFn: async (id: string) => {
        const res = await getAPIClient().api.threads[":id"].$delete({ param: { id } });
        if (!res.ok) throw new Error(`DELETE /api/threads/${id} → ${res.status}`);
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: serverQueries.threads.all });
      },
    }),
  },

  comments: {
    create: () => ({
      mutationFn: async (vars: { threadId: string; body: string }) => {
        const res = await getAPIClient().api.comments.$post({
          json: { thread_id: vars.threadId, body: vars.body },
        });
        if (!res.ok) throw new Error(`POST /api/comments → ${res.status}`);
        return ((await res.json()).comment ?? null) as Comment | null;
      },
      onSuccess: (_c: Comment | null, vars: { threadId: string; body: string }) => {
        void queryClient.invalidateQueries({
          queryKey: serverQueries.comments.list(vars.threadId).queryKey,
        });
      },
    }),

    edit: () => ({
      mutationFn: async (vars: { id: string; body: string }) => {
        const res = await getAPIClient().api.comments[":id"].$patch({
          param: { id: vars.id },
          json: { body: vars.body },
        });
        if (!res.ok) throw new Error(`PATCH /api/comments/${vars.id} → ${res.status}`);
        return ((await res.json()).comment ?? null) as Comment | null;
      },
      onSuccess: (c: Comment | null) => {
        if (c)
          void queryClient.invalidateQueries({
            queryKey: serverQueries.comments.list(c.thread_id).queryKey,
          });
      },
    }),

    // Head-comment removal cascades on the worker; the response carries
    // `thread_deleted: true` in that case. Local cache must drop the parent
    // thread + its comments and clear `openThreadId` if it pointed at the
    // dead thread.
    delete: () => ({
      mutationFn: async (vars: { id: string; threadId: string }) => {
        const res = await getAPIClient().api.comments[":id"].$delete({
          param: { id: vars.id },
        });
        if (!res.ok) throw new Error(`DELETE /api/comments/${vars.id} → ${res.status}`);
        return (await res.json()) as { ok: true; thread_deleted: true } | { comment: Comment };
      },
      onSuccess: (
        result: { ok: true; thread_deleted: true } | { comment: Comment },
        vars: { id: string; threadId: string },
      ) => {
        if ("thread_deleted" in result && result.thread_deleted) {
          void queryClient.invalidateQueries({ queryKey: serverQueries.threads.all });
          queryClient.removeQueries({
            queryKey: serverQueries.comments.list(vars.threadId).queryKey,
          });
          if (openThreadId.value === vars.threadId) openThreadId.value = null;
        } else {
          void queryClient.invalidateQueries({
            queryKey: serverQueries.comments.list(vars.threadId).queryKey,
          });
        }
      },
    }),
  },
};
