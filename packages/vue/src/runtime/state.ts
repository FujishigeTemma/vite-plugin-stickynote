import { computed, reactive, ref, watch, type ComputedRef, type Ref } from "vue";
import type { ApiClient } from "./api.ts";
import type { OverlayOptions } from "../options.ts";
import type { Comment, Thread } from "./types.ts";
import { findInstance } from "./vue-instance.ts";

export type StickynoteStore = {
  options: OverlayOptions;
  api: ApiClient;
  active: Ref<boolean>;
  panelOpen: Ref<boolean>;
  showResolved: Ref<boolean>;
  currentRoute: Ref<string>;
  threads: Ref<Thread[]>;
  commentsByThread: Record<string, Comment[]>;
  openThreadId: Ref<string | null>;
  // Identify the signed-in user so own-comment edit/delete checks compare
  // against the verified identity rather than guessing.
  me: Ref<{ sub: string; name: string } | null>;
  threadsForCurrentRoute: ComputedRef<Thread[]>;
  visibleThreads: ComputedRef<Thread[]>;
  toggleActive: () => void;
  refreshThreads: () => Promise<void>;
  loadComments: (threadId: string) => Promise<void>;
  openThread: (id: string | null) => Promise<void>;
  toggleResolved: (thread: Thread) => Promise<void>;
  createThread: (
    input: Omit<Parameters<ApiClient["createThread"]>[0], "route" | "url">,
  ) => Promise<Thread>;
  reply: (threadId: string, body: string) => Promise<void>;
  editComment: (id: string, body: string) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
};

export function createStore(options: OverlayOptions, api: ApiClient): StickynoteStore {
  const active = ref(false);
  const panelOpen = ref(false);
  const showResolved = ref(false);
  const currentRoute = ref(currentPath());
  const threads = ref<Thread[]>([]);
  const commentsByThread = reactive<Record<string, Comment[]>>({});
  const openThreadId = ref<string | null>(null);
  const me = ref<{ sub: string; name: string } | null>(null);

  async function loadMe(): Promise<void> {
    if (me.value) return;
    me.value = await api.me();
  }

  const threadsForCurrentRoute = computed(() =>
    threads.value.filter((t) => t.route === currentRoute.value),
  );

  // Resolved threads are hidden unless the user opted in via the panel toggle.
  const visibleThreads = computed(() =>
    showResolved.value
      ? threadsForCurrentRoute.value
      : threadsForCurrentRoute.value.filter((t) => t.status === "open"),
  );

  async function refreshThreads(): Promise<void> {
    threads.value = await api.listThreads({
      includeResolved: showResolved.value,
    });
  }

  async function loadComments(threadId: string): Promise<void> {
    commentsByThread[threadId] = await api.listComments(threadId);
  }

  async function openThread(id: string | null): Promise<void> {
    openThreadId.value = id;
    if (id) {
      panelOpen.value = true;
      await loadComments(id);
    }
  }

  async function toggleResolved(thread: Thread): Promise<void> {
    const next = thread.status === "open" ? "resolved" : "open";
    const updated = await api.setStatus(thread.id, next);
    if (!updated) return;
    const i = threads.value.findIndex((t) => t.id === thread.id);
    if (i >= 0) threads.value.splice(i, 1, updated);
  }

  async function createThread(
    input: Omit<Parameters<ApiClient["createThread"]>[0], "route" | "url">,
  ): Promise<Thread> {
    const result = await api.createThread({
      ...input,
      route: currentRoute.value,
      url: window.location.href,
    });
    threads.value = [result.thread, ...threads.value];
    commentsByThread[result.thread.id] = result.comments;
    return result.thread;
  }

  async function reply(threadId: string, body: string): Promise<void> {
    const c = await api.createReply(threadId, body);
    if (!c) return;
    const list = commentsByThread[threadId] ?? [];
    commentsByThread[threadId] = [...list, c];
  }

  async function editComment(id: string, body: string): Promise<void> {
    const c = await api.editComment(id, body);
    if (!c) return;
    const list = commentsByThread[c.thread_id] ?? [];
    commentsByThread[c.thread_id] = list.map((x) => (x.id === id ? c : x));
  }

  async function deleteComment(id: string): Promise<void> {
    const result = await api.deleteComment(id);
    if (result.thread_deleted) {
      // Head-comment removal cascades; reflect locally.
      const target = Object.entries(commentsByThread).find(([, list]) =>
        list.some((x) => x.id === id),
      );
      if (target) {
        const [tid] = target;
        threads.value = threads.value.filter((t) => t.id !== tid);
        delete commentsByThread[tid];
        if (openThreadId.value === tid) openThreadId.value = null;
      }
      return;
    }
    if (result.comment) {
      const c = result.comment;
      const list = commentsByThread[c.thread_id] ?? [];
      commentsByThread[c.thread_id] = list.map((x) => (x.id === id ? c : x));
    }
  }

  function toggleActive(): void {
    active.value = !active.value;
    if (active.value) {
      void loadMe();
      void refreshThreads();
    } else {
      openThreadId.value = null;
    }
  }

  return {
    options,
    api,
    active,
    panelOpen,
    showResolved,
    currentRoute,
    threads,
    commentsByThread,
    openThreadId,
    me,
    threadsForCurrentRoute,
    visibleThreads,
    toggleActive,
    refreshThreads,
    loadComments,
    openThread,
    toggleResolved,
    createThread,
    reply,
    editComment,
    deleteComment,
  };
}

function currentPath(): string {
  return window.location.pathname;
}

type RouterLike = {
  currentRoute: { value: { fullPath: string; matched: { path: string }[] } };
};

// Prefer the host app's vue-router so we get route patterns ("/users/:id")
// per PLAN §7.3. Falls back to popstate when no router is installed; we
// intentionally don't monkey-patch history.pushState/replaceState.
export function setupRouteTracking(store: StickynoteStore): () => void {
  const router = findHostRouter();
  if (router) {
    return watch(
      () => router.currentRoute.value,
      (r) => {
        const matched = r.matched[r.matched.length - 1];
        store.currentRoute.value = matched?.path ?? r.fullPath;
        void store.refreshThreads();
      },
      { immediate: true },
    );
  }
  const onPop = (): void => {
    store.currentRoute.value = currentPath();
    void store.refreshThreads();
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}

function findHostRouter(): RouterLike | null {
  // Any inspector-tagged element belongs to the host app's tree; from there
  // we walk up to its component and read the app's globalProperties.
  const anchor = document.querySelector("[data-v-inspector]");
  if (!anchor) return null;
  const inst = findInstance(anchor);
  const router = inst?.appContext?.config?.globalProperties?.$router;
  return (router as RouterLike | undefined) ?? null;
}
