<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "../store-inject.ts";
import type { Comment } from "../types.ts";
import CommentForm from "./CommentForm.vue";

const props = defineProps<{ comment: Comment }>();
const store = useStore();

const editing = ref(false);

// Only the comment's author can edit/delete. The current user comes from
// the worker's /api/me, which echoes the verified JWT sub regardless of
// auth path (Clerk JWT or dev-bearer fallback).
const ownedByCurrent = computed(() => store.me.value?.sub === props.comment.created_by);

async function onEdit(body: string): Promise<void> {
  await store.editComment(props.comment.id, body);
  editing.value = false;
}

async function onDelete(): Promise<void> {
  if (!confirm("Delete this comment?")) return;
  await store.deleteComment(props.comment.id);
}
</script>

<template>
  <div class="sn-comment" :class="{ 'sn-deleted': props.comment.deleted_at }">
    <div class="sn-comment-head">
      <span class="sn-comment-author">{{ props.comment.created_by_name }}</span>
      <span v-if="ownedByCurrent && !props.comment.deleted_at" class="sn-comment-actions">
        <button type="button" @click="editing = !editing">
          {{ editing ? "cancel" : "edit" }}
        </button>
        <button type="button" @click="onDelete">delete</button>
      </span>
    </div>
    <div v-if="props.comment.deleted_at" class="sn-comment-body">[deleted comment]</div>
    <div v-else-if="!editing" class="sn-comment-body">
      {{ props.comment.body }}
    </div>
    <CommentForm
      v-else
      :initial-body="props.comment.body"
      submit-label="Save"
      cancelable
      @submit="onEdit"
      @cancel="editing = false"
    />
  </div>
</template>

<style scoped>
.sn-comment {
  border: 1px solid #f3f4f6;
  border-radius: 6px;
  padding: 8px 10px;
}
.sn-comment.sn-deleted {
  color: #9ca3af;
  font-style: italic;
}
.sn-comment-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}
.sn-comment-author {
  font-weight: 600;
  color: #111827;
}
.sn-comment-actions {
  display: flex;
  gap: 6px;
}
.sn-comment-actions button {
  background: transparent;
  border: none;
  color: #6b7280;
  font: inherit;
  cursor: pointer;
  padding: 0;
}
.sn-comment-actions button:hover {
  color: #ef4444;
}
</style>
