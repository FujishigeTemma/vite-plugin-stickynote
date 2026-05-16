<script setup lang="ts">
import { computed } from "vue";
import { buildGithubUrl, componentName } from "../inspector.ts";
import { useStore } from "../store-inject.ts";
import CommentForm from "./CommentForm.vue";
import CommentItem from "./CommentItem.vue";

const store = useStore();

const thread = computed(() => {
  const id = store.openThreadId.value;
  if (!id) return null;
  return store.threads.value.find((t) => t.id === id) ?? null;
});

const comments = computed(() => {
  const id = store.openThreadId.value;
  if (!id) return [];
  return store.commentsByThread[id] ?? [];
});

const githubUrl = computed(() => {
  if (!thread.value) return null;
  return buildGithubUrl(
    store.options.githubRepo,
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

async function reply(body: string): Promise<void> {
  if (!thread.value) return;
  await store.reply(thread.value.id, body);
}

async function toggleResolved(): Promise<void> {
  if (!thread.value) return;
  await store.toggleResolved(thread.value);
}

function back(): void {
  void store.openThread(null);
}
</script>

<template>
  <template v-if="thread">
    <button class="sn-detail-back" type="button" @click="back">← back to threads</button>
    <div class="sn-detail-meta">
      <span>{{ componentLabel }}</span>
      <a v-if="githubUrl" :href="githubUrl" target="_blank" rel="noopener">github</a>
      <span v-if="thread.dirty_build" class="sn-badge">local changes</span>
      <span v-if="viewportWarn" class="sn-badge">viewport differs</span>
    </div>
    <div class="sn-comments">
      <CommentItem v-for="c in comments" :key="c.id" :comment="c" />
    </div>
    <CommentForm submit-label="Reply" @submit="reply" />
    <div class="sn-form-actions">
      <button type="button" @click="toggleResolved">
        {{ thread.status === "open" ? "Resolve" : "Reopen" }}
      </button>
    </div>
  </template>
</template>

<style scoped>
.sn-detail-back {
  background: transparent;
  border: none;
  color: #6b7280;
  font: inherit;
  cursor: pointer;
  padding: 0;
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
</style>
