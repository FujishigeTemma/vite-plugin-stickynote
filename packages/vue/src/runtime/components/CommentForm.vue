<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

const props = defineProps<{
  initialBody?: string;
  submitLabel?: string;
  cancelable?: boolean;
}>();
const emit = defineEmits<{
  submit: [body: string];
  cancel: [];
}>();

const body = ref(props.initialBody ?? "");
const formRef = useTemplateRef<HTMLFormElement>("formRef");

function submit(): void {
  const text = body.value.trim();
  if (!text) return;
  emit("submit", text);
  body.value = "";
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    formRef.value?.requestSubmit();
  }
}
</script>

<template>
  <form ref="formRef" class="sn-form" @submit.prevent="submit">
    <textarea v-model="body" placeholder="Write a comment…" @keydown="onKeydown" />
    <div class="sn-form-actions">
      <button v-if="props.cancelable" type="button" @click="emit('cancel')">cancel</button>
      <button type="submit" class="sn-primary" :disabled="!body.trim()">
        {{ props.submitLabel ?? "Reply" }}
      </button>
    </div>
  </form>
</template>
