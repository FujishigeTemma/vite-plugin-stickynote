<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import { computed, ref } from "vue";

import { hostRouter } from "../host-router.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";
import { openThread, showResolved } from "../state.ts";
import type { Thread } from "../types.ts";

const search = ref("");
// Debounce so each keystroke doesn't mint a new query cache entry and fire
// its own request — 200 ms feels instant but coalesces typing bursts.
const debouncedSearch = refDebounced(search, 200);

const { data, isFetching } = useQuery(
  {
    ...serverQueries.threads.list(
      () => undefined,
      () => showResolved.value,
      () => debouncedSearch.value,
    ),
    // Keep the previous result while the user types so the list doesn't
    // collapse to "empty" between keystrokes.
    placeholderData: (prev) => prev,
  },
  queryClient,
);

const threads = computed<Thread[]>(() => data.value ?? []);

function compLabel(t: Thread): string {
  return t.components[0]?.name ?? "page-wide";
}

// Returns an in-app path when `absUrl` is same-origin; null otherwise. A
// cross-origin thread (e.g. one worker serving multiple frontends, or a
// stored staging URL clicked from localhost) must do a full navigation
// rather than silently coerce to a same-origin path.
function sameOriginTarget(absUrl: string): string | null {
  try {
    const u = new URL(absUrl);
    if (u.origin !== window.location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

async function onPick(t: Thread): Promise<void> {
  const router = hostRouter.value;
  const target = sameOriginTarget(t.url);
  // Runtime check on `push` — the type declares it required but the host
  // installer only verifies `$router` is truthy. A host that exposes a
  // non-vue-router shim with currentRoute/afterEach but no push must fall
  // back to a full navigation.
  if (router && typeof router.push === "function" && target) {
    try {
      // vue-router 4 resolves with a NavigationFailure (rather than reject)
      // when guards cancel or redirect; treat any non-undefined result as a
      // navigation that didn't complete, and skip opening the detail.
      const result = await router.push(target);
      if (result != null) return;
    } catch {
      // True rejection (rare; e.g. guard throws). Skip opening the panel
      // for an unreachable thread.
      return;
    }
    openThread(t.id);
    return;
  }
  if (t.url) {
    window.location.assign(t.url);
    return;
  }
  openThread(t.id);
}
</script>

<template>
  <div class="sn-all">
    <input
      v-model="search"
      type="search"
      class="sn-search"
      placeholder="search comments…"
      autocomplete="off"
      spellcheck="false"
    />
    <div v-if="threads.length === 0" class="sn-empty">
      {{ isFetching ? "loading…" : search.trim() ? "no matches" : "no threads yet" }}
    </div>
    <div class="sn-thread-list">
      <button
        v-for="t in threads"
        :key="t.id"
        type="button"
        class="sn-thread-card"
        @click="onPick(t)"
      >
        <div class="sn-thread-meta">
          <span class="sn-route">{{ t.route }}</span>
          <span class="sn-comp">· {{ compLabel(t) }}</span>
          <span>· {{ t.created_by_name }}</span>
          <span v-if="t.status === 'resolved'">· resolved</span>
        </div>
        <div class="sn-thread-body">{{ t.first_comment.body }}</div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.sn-all {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sn-search {
  font: inherit;
  background: var(--sn-input-bg);
  color: var(--sn-input-text);
  border: 1px solid var(--sn-input-border);
  border-radius: 6px;
  padding: 6px 10px;
  width: 100%;
}
.sn-search::placeholder {
  color: var(--sn-input-placeholder);
}
.sn-empty {
  color: var(--sn-text-subtle);
  font-style: italic;
  padding: 8px 0;
}
.sn-thread-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sn-thread-card {
  border: 1px solid var(--sn-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--sn-surface);
  color: var(--sn-text);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  font: inherit;
}
.sn-thread-card:hover {
  border-color: var(--sn-accent-border);
}
.sn-thread-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--sn-text-muted);
}
.sn-route {
  font-family: ui-monospace, monospace;
  color: var(--sn-text);
  background: var(--sn-surface-raised);
  padding: 1px 6px;
  border-radius: 4px;
}
.sn-comp {
  font-family: ui-monospace, monospace;
}
.sn-thread-body {
  color: var(--sn-text);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
