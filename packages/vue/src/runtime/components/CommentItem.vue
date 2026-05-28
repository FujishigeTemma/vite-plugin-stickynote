<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";

import { serverMutations } from "../mutations.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";
import type { Comment } from "../types.ts";
import CommentForm from "./CommentForm.vue";

const props = defineProps<{ comment: Comment }>();

const { data: me } = useQuery(serverQueries.me(), queryClient);
const editComment = useMutation(serverMutations.comments.edit(), queryClient);
const deleteComment = useMutation(serverMutations.comments.delete(), queryClient);

const editing = ref(false);

// `me.sub` is the JWT-verified subject — same identity regardless of auth
// path (Clerk JWT or dev-bearer fallback).
const ownedByCurrent = computed(() => me.value?.sub === props.comment.created_by);

function onEdit(body: string): void {
  editComment.mutate(
    { threadId: props.comment.thread_id, commentId: props.comment.id, body },
    { onSuccess: () => (editing.value = false) },
  );
}

function onDelete(): void {
  if (!confirm("Delete this comment?")) return;
  deleteComment.mutate({ threadId: props.comment.thread_id, commentId: props.comment.id });
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
  border: 1px solid var(--sn-border);
  border-radius: 6px;
  padding: 8px 10px;
}
.sn-comment.sn-deleted {
  color: var(--sn-text-subtle);
  font-style: italic;
}
.sn-comment-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--sn-text-muted);
  margin-bottom: 4px;
}
.sn-comment-author {
  font-weight: 600;
  color: var(--sn-text);
}
.sn-comment-actions {
  display: flex;
  gap: 6px;
}
.sn-comment-actions button {
  background: transparent;
  border: none;
  color: var(--sn-text-muted);
  font: inherit;
  cursor: pointer;
  padding: 0;
}
.sn-comment-actions button:hover {
  color: var(--sn-danger);
}
.sn-comment-body {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
