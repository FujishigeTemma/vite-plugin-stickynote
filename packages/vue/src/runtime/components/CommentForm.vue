<script setup lang="ts">
import { ref, useTemplateRef, watch } from "vue";

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
const saving = ref(false);
const formRef = useTemplateRef<HTMLFormElement>("formRef");

watch(
  () => props.initialBody,
  (next) => {
    body.value = next ?? "";
  },
);

async function submit(): Promise<void> {
  const text = body.value.trim();
  if (!text) return;
  saving.value = true;
  try {
    emit("submit", text);
    body.value = "";
  } finally {
    saving.value = false;
  }
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
      <button type="submit" class="sn-primary" :disabled="saving || !body.trim()">
        {{ props.submitLabel ?? "Reply" }}
      </button>
    </div>
  </form>
</template>
