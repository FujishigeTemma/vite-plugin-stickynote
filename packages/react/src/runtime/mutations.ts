import { getAPIClient } from "./api-client.ts";
import { serverQueries } from "./queries/server.ts";
import { queryClient } from "./query-client.ts";
import { useStore } from "./store.ts";
import type { CreateThreadInput, Thread } from "./types.ts";

// Hoisting mutationFn to a local const lets onSuccess reference its
// inferred types via `Awaited<ReturnType<typeof mutationFn>>` — the
// inline-object-literal pattern otherwise blocks TS from flowing
// inference between sibling properties.

export const serverMutations = {
  threads: {
    create: () => {
      const mutationFn = async (input: Omit<CreateThreadInput, "route" | "url">) => {
        const route = useStore.getState().currentRoute;
        const res = await getAPIClient().api.threads.$post({
          json: { ...input, route, url: window.location.href },
        });
        if (!res.ok) throw new Error(`POST /api/threads → ${res.status}`);
        return await res.json();
      };
      type Data = Awaited<ReturnType<typeof mutationFn>>;
      return {
        mutationFn,
        onSuccess: ({ thread, comments }: Data) => {
          queryClient.setQueryData(
            serverQueries.threads.comments.list(thread.id).queryKey,
            comments,
          );
          void queryClient.invalidateQueries({ queryKey: serverQueries.threads.all });
        },
      };
    },

    setStatus: () => ({
      mutationFn: async (vars: { threadId: string; status: "open" | "resolved" }) => {
        const res = await getAPIClient().api.threads[":threadId"].status.$patch({
          param: { threadId: vars.threadId },
          json: { status: vars.status },
        });
        if (!res.ok) throw new Error(`PATCH /api/threads/${vars.threadId}/status → ${res.status}`);
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: serverQueries.threads.all });
      },
    }),

    // Optimistic: pin tracks the cursor on drop, so the in-flight window
    // must not snap it back. Snapshot every threads-list cache entry,
    // mutate them, replay on error, then invalidate to reconcile.
    updatePosition: () => ({
      mutationFn: async (vars: { threadId: string; x_ratio: number; y_ratio: number }) => {
        const res = await getAPIClient().api.threads[":threadId"].position.$patch({
          param: { threadId: vars.threadId },
          json: { x_ratio: vars.x_ratio, y_ratio: vars.y_ratio },
        });
        if (!res.ok)
          throw new Error(`PATCH /api/threads/${vars.threadId}/position → ${res.status}`);
      },
      onMutate: async (vars: { threadId: string; x_ratio: number; y_ratio: number }) => {
        await queryClient.cancelQueries({ queryKey: serverQueries.threads.all });
        const prev = queryClient.getQueriesData<Thread[]>({
          queryKey: serverQueries.threads.all,
        });
        queryClient.setQueriesData<Thread[]>({ queryKey: serverQueries.threads.all }, (list) =>
          list?.map((t) =>
            t.id === vars.threadId ? { ...t, x_ratio: vars.x_ratio, y_ratio: vars.y_ratio } : t,
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
      mutationFn: async (vars: { threadId: string }) => {
        const res = await getAPIClient().api.threads[":threadId"].$delete({
          param: { threadId: vars.threadId },
        });
        if (!res.ok) throw new Error(`DELETE /api/threads/${vars.threadId} → ${res.status}`);
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: serverQueries.threads.all });
      },
    }),
  },

  comments: {
    create: () => {
      type Vars = { threadId: string; body: string };
      const mutationFn = async (vars: Vars) => {
        const res = await getAPIClient().api.threads[":threadId"].comments.$post({
          param: { threadId: vars.threadId },
          json: { body: vars.body },
        });
        if (!res.ok) throw new Error(`POST /api/threads/${vars.threadId}/comments → ${res.status}`);
        return (await res.json()).comment;
      };
      return {
        mutationFn,
        onSuccess: (_c: Awaited<ReturnType<typeof mutationFn>>, vars: Vars) => {
          void queryClient.invalidateQueries({
            queryKey: serverQueries.threads.comments.list(vars.threadId).queryKey,
          });
        },
      };
    },

    edit: () => {
      type Vars = { threadId: string; commentId: string; body: string };
      const mutationFn = async (vars: Vars) => {
        const res = await getAPIClient().api.threads[":threadId"].comments[":commentId"].$patch({
          param: { threadId: vars.threadId, commentId: vars.commentId },
          json: { body: vars.body },
        });
        if (!res.ok)
          throw new Error(
            `PATCH /api/threads/${vars.threadId}/comments/${vars.commentId} → ${res.status}`,
          );
        return (await res.json()).comment;
      };
      return {
        mutationFn,
        onSuccess: (_c: Awaited<ReturnType<typeof mutationFn>>, vars: Vars) => {
          void queryClient.invalidateQueries({
            queryKey: serverQueries.threads.comments.list(vars.threadId).queryKey,
          });
        },
      };
    },

    // Head-comment removal cascades on the worker; the response carries
    // `thread_deleted: true` in that case. Local cache must drop the
    // parent thread + its comments and clear `openThreadId` if it
    // pointed at the dead thread.
    delete: () => {
      type Vars = { threadId: string; commentId: string };
      const mutationFn = async (vars: Vars) => {
        const res = await getAPIClient().api.threads[":threadId"].comments[":commentId"].$delete({
          param: { threadId: vars.threadId, commentId: vars.commentId },
        });
        if (!res.ok)
          throw new Error(
            `DELETE /api/threads/${vars.threadId}/comments/${vars.commentId} → ${res.status}`,
          );
        return await res.json();
      };
      return {
        mutationFn,
        onSuccess: (result: Awaited<ReturnType<typeof mutationFn>>, vars: Vars) => {
          if ("thread_deleted" in result && result.thread_deleted) {
            void queryClient.invalidateQueries({ queryKey: serverQueries.threads.all });
            queryClient.removeQueries({
              queryKey: serverQueries.threads.comments.list(vars.threadId).queryKey,
            });
            const { openThreadId, openThread } = useStore.getState();
            if (openThreadId === vars.threadId) openThread(null);
          } else {
            void queryClient.invalidateQueries({
              queryKey: serverQueries.threads.comments.list(vars.threadId).queryKey,
            });
          }
        },
      };
    },
  },
};
