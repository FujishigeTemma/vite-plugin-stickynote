<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { buildGithubUrl, componentKey } from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";
import { active, openThread, openThreadId, options } from "../state.ts";
import CommentForm from "./CommentForm.vue";
import CommentItem from "./CommentItem.vue";

// Fetch the thread by id directly (not via the list query) so it stays
// rendered after the user resolves it — the list query drops resolved
// threads unless `showResolved` is on, but the detail endpoint returns the
// thread regardless of status. setStatus invalidates the `["sn","threads"]`
// prefix, so this query refetches with the new status applied in place.
// Poll on the same cadence as the list query so concurrent edits from
// other collaborators surface without forcing the user to back out.
const detailQ = useQuery(
  {
    ...serverQueries.threads.detail(openThreadId),
    refetchInterval: () => (active.value ? 5000 : false),
  },
  queryClient,
);
const { data: comments } = useQuery(serverQueries.threads.comments.list(openThreadId), queryClient);

const reply = useMutation(serverMutations.comments.create(), queryClient);
const setStatus = useMutation(serverMutations.threads.setStatus(), queryClient);

const thread = computed(() => detailQ.data.value?.thread ?? null);
const isLoading = computed(() => detailQ.isPending.value && !detailQ.data.value);
const isError = computed(() => detailQ.isError.value && !detailQ.data.value);

const primaryComponent = computed(() => thread.value?.components[0] ?? null);

const githubUrl = computed(() => {
  if (!thread.value || !options.value) return null;
  const c = primaryComponent.value;
  if (!c) return null;
  return buildGithubUrl(options.value.githubRepo, thread.value.commit_hash, c.path, c.line);
});

const viewportWarn = computed(() => {
  if (!thread.value || !primaryComponent.value) return false;
  const ratio = window.innerWidth / thread.value.viewport_w;
  return ratio < 0.7 || ratio > 1.4;
});

const componentLabel = computed(() => {
  const c = primaryComponent.value;
  if (!c) return "page-wide";
  return `${c.name} · ${c.path}:${c.line}`;
});

const additionalLinks = computed(() => {
  const t = thread.value;
  if (!t || t.components.length <= 1) return [];
  const repo = options.value?.githubRepo ?? null;
  return t.components.slice(1).map((c) => ({
    key: componentKey(c),
    label: `${c.name} · ${c.path}:${c.line}`,
    url: buildGithubUrl(repo, t.commit_hash, c.path, c.line),
  }));
});

function onReply(body: string): void {
  if (!thread.value) return;
  reply.mutate({ threadId: thread.value.id, body });
}

function toggleResolved(): void {
  if (!thread.value) return;
  const next = thread.value.status === "open" ? "resolved" : "open";
  setStatus.mutate({ threadId: thread.value.id, status: next });
}
</script>

<template>
  <div class="sn-thread-detail">
    <button class="sn-detail-back" type="button" @click="openThread(null)">
      ← back to threads
    </button>
    <template v-if="thread">
      <div class="sn-detail-meta">
        <span>{{ componentLabel }}</span>
        <a v-if="githubUrl" :href="githubUrl" target="_blank" rel="noopener">github</a>
        <span v-if="thread.dirty_build" class="sn-badge">local changes</span>
        <span v-if="viewportWarn" class="sn-badge">viewport differs</span>
      </div>
      <ul v-if="additionalLinks.length" class="sn-detail-linked">
        <li v-for="link in additionalLinks" :key="link.key">
          <span>{{ link.label }}</span>
          <a v-if="link.url" :href="link.url" target="_blank" rel="noopener">github</a>
        </li>
      </ul>
      <div class="sn-comments">
        <CommentItem v-for="c in comments ?? []" :key="c.id" :comment="c" />
      </div>
      <CommentForm submit-label="Reply" @submit="onReply">
        <template #leading>
          <button type="button" @click="toggleResolved">
            {{ thread.status === "open" ? "Resolve" : "Reopen" }}
          </button>
        </template>
      </CommentForm>
    </template>
    <div v-else-if="isError" class="sn-detail-status">
      Couldn't load this thread. It may have been deleted, or the worker is unreachable.
    </div>
    <div v-else-if="isLoading" class="sn-detail-status">loading…</div>
  </div>
</template>

<style scoped>
.sn-thread-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sn-detail-back {
  background: transparent;
  border: none;
  color: var(--sn-text-muted);
  font: inherit;
  cursor: pointer;
  padding: 0;
  text-align: left;
}
.sn-detail-back:hover {
  color: var(--sn-text);
}
.sn-detail-status {
  color: var(--sn-text-muted);
  font-style: italic;
}
.sn-detail-meta {
  font-size: 11px;
  color: var(--sn-text-muted);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.sn-detail-meta a {
  color: var(--sn-link);
}
.sn-comments {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sn-detail-linked {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--sn-text-muted);
}
.sn-detail-linked li {
  display: flex;
  gap: 6px;
  align-items: center;
}
.sn-detail-linked a {
  color: var(--sn-link);
}
</style>
