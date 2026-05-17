<script setup lang="ts">
import { useMutation } from "@tanstack/vue-query";
import { computed, ref } from "vue";

import { useThreadsList } from "../composables.ts";
import { isThreadStale } from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { queryClient } from "../query-client.ts";
import { elementMap, openThread, openThreadId, options } from "../state.ts";
import type { Thread } from "../types.ts";
import CommentForm from "./CommentForm.vue";

const { visible } = useThreadsList();
const createThread = useMutation(serverMutations.threads.create(), queryClient);

const showPageWideForm = ref(false);

const grouped = computed(() => ({
  pageWide: visible.value.filter((t) => t.components.length === 0),
  component: visible.value.filter((t) => t.components.length > 0),
}));

function isStale(t: Thread): boolean {
  return isThreadStale(t, elementMap.value);
}

function compLabel(t: Thread): string {
  return t.components[0]?.name ?? "page-wide";
}

async function createPageWide(body: string): Promise<void> {
  if (!options.value) return;
  await createThread.mutateAsync({
    commit_hash: options.value.commitHash,
    dirty_build: options.value.dirtyBuild,
    x_ratio: 0,
    y_ratio: 0,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    components: [],
    body,
  });
  showPageWideForm.value = false;
}
</script>

<template>
  <div>
    <h3 class="sn-section-title">For This Page</h3>
    <div v-if="grouped.pageWide.length === 0 && !showPageWideForm" class="sn-empty">
      no page-wide threads on this route
    </div>
    <div class="sn-thread-list">
      <div
        v-for="t in grouped.pageWide"
        :key="t.id"
        class="sn-thread-card"
        :class="{ 'sn-active-thread': openThreadId === t.id }"
        @click="openThread(t.id)"
      >
        <div class="sn-thread-meta">
          <span class="sn-comp">{{ compLabel(t) }}</span>
          <span>· {{ t.created_by_name }}</span>
          <span v-if="t.status === 'resolved'">· resolved</span>
        </div>
        <div class="sn-thread-body">{{ t.first_comment_body }}</div>
      </div>
      <div v-if="showPageWideForm" class="sn-thread-card">
        <CommentForm
          submit-label="Post"
          cancelable
          @submit="createPageWide"
          @cancel="showPageWideForm = false"
        />
      </div>
      <div v-else class="sn-form-actions">
        <button type="button" @click="showPageWideForm = true">+ comment</button>
      </div>
    </div>

    <h3 class="sn-section-title">Per Component(s)</h3>
    <div v-if="grouped.component.length === 0" class="sn-empty">
      no component pins on this route
    </div>
    <div class="sn-thread-list">
      <div
        v-for="t in grouped.component"
        :key="t.id"
        class="sn-thread-card"
        :class="{
          'sn-active-thread': openThreadId === t.id,
          'sn-thread-stale': isStale(t),
        }"
        @click="openThread(t.id)"
      >
        <div class="sn-thread-meta">
          <span class="sn-comp">{{ compLabel(t) }}</span>
          <span>· {{ t.created_by_name }}</span>
          <span v-if="t.status === 'resolved'">· resolved</span>
          <span v-if="isStale(t)" class="sn-badge">stale</span>
        </div>
        <div class="sn-thread-body">{{ t.first_comment_body }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sn-section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b7280;
  margin: 8px 0 4px;
}
.sn-empty {
  color: #9ca3af;
  font-style: italic;
  padding: 8px 0;
}
.sn-thread-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sn-thread-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  background: white;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sn-thread-card:hover {
  border-color: #c4b5fd;
}
.sn-thread-card.sn-active-thread {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px #ede9fe;
}
.sn-thread-card.sn-thread-stale {
  background: #f9fafb;
}
.sn-thread-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  color: #6b7280;
}
.sn-thread-meta .sn-comp {
  font-family: ui-monospace, monospace;
  color: #374151;
}
.sn-thread-body {
  color: #111827;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
