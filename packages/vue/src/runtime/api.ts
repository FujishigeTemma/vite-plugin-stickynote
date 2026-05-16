import { hc } from "hono/client";
import type { AppType } from "stickynote-worker/app-type";
import type { Comment, CreateThreadInput, Thread } from "./types.ts";

export type AuthSource = () => string | Promise<string | null> | null;

export type ApiClient = {
  me: () => Promise<{ sub: string; name: string } | null>;
  listThreads: (opts?: { route?: string; includeResolved?: boolean }) => Promise<Thread[]>;
  createThread: (input: CreateThreadInput) => Promise<{ thread: Thread; comments: Comment[] }>;
  setStatus: (id: string, status: "open" | "resolved") => Promise<Thread | null>;
  deleteThread: (id: string) => Promise<void>;
  listComments: (threadId: string) => Promise<Comment[]>;
  createReply: (threadId: string, body: string) => Promise<Comment | null>;
  editComment: (id: string, body: string) => Promise<Comment | null>;
  deleteComment: (id: string) => Promise<{ comment: Comment | null; thread_deleted: boolean }>;
};

export function createApi(baseUrl: string, getToken: AuthSource): ApiClient {
  const client = hc<AppType>(baseUrl, {
    headers: async (): Promise<Record<string, string>> => {
      const token = await Promise.resolve(getToken());
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });

  async function warn(label: string, res: Response): Promise<void> {
    const text = await res.text().catch(() => "");
    console.warn(`[stickynote] ${label} → ${res.status} ${text}`);
  }

  return {
    async me() {
      const res = await client.api.me.$get();
      if (!res.ok) {
        await warn("GET /api/me", res);
        return null;
      }
      return (await res.json()) as { sub: string; name: string };
    },

    async listThreads(opts) {
      const query: { route?: string; includeResolved?: "true" | "false" } = {};
      if (opts?.route) query.route = opts.route;
      if (opts?.includeResolved) query.includeResolved = "true";
      const res = await client.api.threads.$get({ query });
      if (!res.ok) {
        await warn("GET /api/threads", res);
        return [];
      }
      const data = await res.json();
      return data.threads;
    },

    async createThread(input) {
      const res = await client.api.threads.$post({ json: input });
      if (!res.ok) {
        await warn("POST /api/threads", res);
        throw new Error("Failed to create thread");
      }
      return (await res.json()) as { thread: Thread; comments: Comment[] };
    },

    async setStatus(id, status) {
      const res = await client.api.threads[":id"].status.$patch({
        param: { id },
        json: { status },
      });
      if (!res.ok) {
        await warn(`PATCH /api/threads/${id}/status`, res);
        return null;
      }
      const data = await res.json();
      return data.thread ?? null;
    },

    async deleteThread(id) {
      const res = await client.api.threads[":id"].$delete({ param: { id } });
      if (!res.ok) {
        await warn(`DELETE /api/threads/${id}`, res);
      }
    },

    async listComments(threadId) {
      const res = await client.api.threads[":id"].comments.$get({ param: { id: threadId } });
      if (!res.ok) {
        await warn(`GET /api/threads/${threadId}/comments`, res);
        return [];
      }
      const data = await res.json();
      return data.comments;
    },

    async createReply(threadId, body) {
      const res = await client.api.comments.$post({
        json: { thread_id: threadId, body },
      });
      if (!res.ok) {
        await warn("POST /api/comments", res);
        return null;
      }
      const data = await res.json();
      return (data.comment ?? null) as Comment | null;
    },

    async editComment(id, body) {
      const res = await client.api.comments[":id"].$patch({
        param: { id },
        json: { body },
      });
      if (!res.ok) {
        await warn(`PATCH /api/comments/${id}`, res);
        return null;
      }
      const data = await res.json();
      return (data.comment ?? null) as Comment | null;
    },

    async deleteComment(id) {
      const res = await client.api.comments[":id"].$delete({ param: { id } });
      if (!res.ok) {
        await warn(`DELETE /api/comments/${id}`, res);
        return { comment: null, thread_deleted: false };
      }
      const data = (await res.json()) as { ok: true; thread_deleted: true } | { comment: Comment };
      if ("thread_deleted" in data && data.thread_deleted) {
        return { comment: null, thread_deleted: true };
      }
      if ("comment" in data) {
        return { comment: data.comment, thread_deleted: false };
      }
      return { comment: null, thread_deleted: false };
    },
  };
}
