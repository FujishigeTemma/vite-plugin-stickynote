<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { useThreadsList } from "../composables.ts";
import { buildGithubUrl, componentName } from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";
import { openThread, openThreadId, options } from "../state.ts";
import CommentForm from "./CommentForm.vue";
import CommentItem from "./CommentItem.vue";

const { threads } = useThreadsList();
const { data: comments } = useQuery(serverQueries.comments.list(openThreadId), queryClient);

const reply = useMutation(serverMutations.comments.create(), queryClient);
const setStatus = useMutation(serverMutations.threads.setStatus(), queryClient);

const thread = computed(() => {
  const id = openThreadId.value;
  if (!id) return null;
  return threads.value.find((t) => t.id === id) ?? null;
});

const githubUrl = computed(() => {
  if (!thread.value || !options.value) return null;
  return buildGithubUrl(
    options.value.githubRepo,
    thread.value.commit_hash,
    thread.value.component_path,
    thread.value.component_line,
  );
});

const viewportWarn = computed(() => {
  if (!thread.value) return false;
  if (thread.value.component_path == null) return false;
  const ratio = window.innerWidth / thread.value.viewport_w;
  return ratio < 0.7 || ratio > 1.4;
});

const componentLabel = computed(() => {
  if (!thread.value?.component_path) return "page-wide";
  return `${componentName(thread.value.component_path)} · ${thread.value.component_path}:${thread.value.component_line}`;
});

const additionalLinks = computed(() => {
  const t = thread.value;
  if (!t || !t.additional_components || t.additional_components.length === 0) return [];
  const repo = options.value?.githubRepo ?? null;
  return t.additional_components.map((c) => ({
    key: `${c.path}:${c.line}#${c.index}`,
    label: `${componentName(c.path)} · ${c.path}:${c.line}`,
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
  setStatus.mutate({ id: thread.value.id, status: next });
}
</script>

<template>
  <div v-if="thread" class="sn-thread-detail">
    <button class="sn-detail-back" type="button" @click="openThread(null)">
      ← back to threads
    </button>
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
    <CommentForm submit-label="Reply" @submit="onReply" />
    <div class="sn-form-actions">
      <button type="button" @click="toggleResolved">
        {{ thread.status === "open" ? "Resolve" : "Reopen" }}
      </button>
    </div>
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
  color: #6b7280;
  font: inherit;
  cursor: pointer;
  padding: 0;
  text-align: left;
}
.sn-detail-back:hover {
  color: #111827;
}
.sn-detail-meta {
  font-size: 11px;
  color: #6b7280;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.sn-detail-meta a {
  color: #3b82f6;
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
  color: #6b7280;
}
.sn-detail-linked li {
  display: flex;
  gap: 6px;
  align-items: center;
}
.sn-detail-linked a {
  color: #3b82f6;
}
</style>
