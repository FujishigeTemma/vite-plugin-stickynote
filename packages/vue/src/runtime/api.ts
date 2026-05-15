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
  async function authHeader(): Promise<Record<string, string>> {
    const token = await Promise.resolve(getToken());
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function call<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(await authHeader()),
      ...(init.headers as Record<string, string> | undefined),
    };
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (res.status === 204) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[stickynote] ${init.method ?? "GET"} ${path} → ${res.status} ${text}`);
      return null;
    }
    return (await res.json()) as T;
  }

  return {
    async me() {
      return await call<{ sub: string; name: string }>("/api/me");
    },

    async listThreads(opts) {
      const q = new URLSearchParams();
      if (opts?.route) q.set("route", opts.route);
      if (opts?.includeResolved) q.set("includeResolved", "true");
      const data = await call<{ threads: Thread[] }>(
        `/api/threads${q.size ? `?${q.toString()}` : ""}`,
      );
      return data?.threads ?? [];
    },

    async createThread(input) {
      const data = await call<{ thread: Thread; comments: Comment[] }>("/api/threads", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!data) throw new Error("Failed to create thread");
      return data;
    },

    async setStatus(id, status) {
      const data = await call<{ thread: Thread }>(`/api/threads/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      return data?.thread ?? null;
    },

    async deleteThread(id) {
      await call<{ ok: true }>(`/api/threads/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },

    async listComments(threadId) {
      const data = await call<{ comments: Comment[] }>(
        `/api/threads/${encodeURIComponent(threadId)}/comments`,
      );
      return data?.comments ?? [];
    },

    async createReply(threadId, body) {
      const data = await call<{ comment: Comment }>("/api/comments", {
        method: "POST",
        body: JSON.stringify({ thread_id: threadId, body }),
      });
      return data?.comment ?? null;
    },

    async editComment(id, body) {
      const data = await call<{ comment: Comment }>(`/api/comments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      });
      return data?.comment ?? null;
    },

    async deleteComment(id) {
      const data = await call<{
        comment?: Comment;
        thread_deleted?: boolean;
      }>(`/api/comments/${encodeURIComponent(id)}`, { method: "DELETE" });
      return {
        comment: data?.comment ?? null,
        thread_deleted: data?.thread_deleted ?? false,
      };
    },
  };
}
