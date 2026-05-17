<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { ELEMENT_MAP_KEY } from "../cache.ts";
import { componentName, isThreadStale } from "../inspector.ts";
import { useStore } from "../store-inject.ts";
import CommentForm from "./CommentForm.vue";
import type { Thread } from "../types.ts";

const store = useStore();
const elementMap = inject(ELEMENT_MAP_KEY);

const showPageWideForm = ref(false);

const grouped = computed(() => {
  const all = store.visibleThreads.value;
  return {
    pageWide: all.filter((t) => t.component_path == null),
    component: all.filter((t) => t.component_path != null),
  };
});

function isStale(t: Thread): boolean {
  const map = elementMap?.value;
  return map ? isThreadStale(t, map) : false;
}

function summary(t: Thread): string {
  // Prefer the live in-memory copy when it exists so edits to the head comment
  // reflect immediately; fall back to the body snapshotted by the list API.
  const list = store.commentsByThread[t.id];
  if (list && list.length > 0) {
    const head = list[0];
    if (head?.deleted_at) return "[deleted]";
    return head?.body ?? "(no body)";
  }
  return t.first_comment_body;
}

function compLabel(t: Thread): string {
  if (!t.component_path) return "page-wide";
  return componentName(t.component_path);
}

async function open(t: Thread): Promise<void> {
  await store.openThread(t.id);
}

async function createPageWide(body: string): Promise<void> {
  await store.createThread({
    component_path: null,
    component_line: null,
    component_index: 0,
    commit_hash: store.options.commitHash,
    dirty_build: store.options.dirtyBuild,
    x_ratio: 0,
    y_ratio: 0,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    body,
  });
  showPageWideForm.value = false;
}
</script>

<template>
  <div>
    <h3 class="sn-section-title">Page-wide</h3>
    <div v-if="grouped.pageWide.length === 0 && !showPageWideForm" class="sn-empty">
      no page-wide threads on this route
    </div>
    <div class="sn-thread-list">
      <div
        v-for="t in grouped.pageWide"
        :key="t.id"
        class="sn-thread-card"
        :class="{ 'sn-active-thread': store.openThreadId.value === t.id }"
        @click="open(t)"
      >
        <div class="sn-thread-meta">
          <span class="sn-comp">{{ compLabel(t) }}</span>
          <span>· {{ t.created_by_name }}</span>
          <span v-if="t.status === 'resolved'">· resolved</span>
        </div>
        <div class="sn-thread-body">{{ summary(t) }}</div>
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
        <button type="button" @click="showPageWideForm = true">+ page-wide comment</button>
      </div>
    </div>

    <h3 class="sn-section-title">Pinned to components</h3>
    <div v-if="grouped.component.length === 0" class="sn-empty">
      no component pins on this route
    </div>
    <div class="sn-thread-list">
      <div
        v-for="t in grouped.component"
        :key="t.id"
        class="sn-thread-card"
        :class="{
          'sn-active-thread': store.openThreadId.value === t.id,
          'sn-thread-stale': isStale(t),
        }"
        @click="open(t)"
      >
        <div class="sn-thread-meta">
          <span class="sn-comp">{{ compLabel(t) }}</span>
          <span>· {{ t.created_by_name }}</span>
          <span v-if="t.status === 'resolved'">· resolved</span>
          <span v-if="isStale(t)" class="sn-badge">stale</span>
        </div>
        <div class="sn-thread-body">{{ summary(t) }}</div>
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
