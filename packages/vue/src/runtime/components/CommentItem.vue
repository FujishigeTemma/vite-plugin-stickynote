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
