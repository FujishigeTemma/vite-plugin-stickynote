<script setup lang="ts">
import { ref, watch } from "vue";

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
</script>

<template>
  <div class="sn-form">
    <textarea v-model="body" placeholder="Write a comment…" />
    <div class="sn-form-actions">
      <button v-if="props.cancelable" type="button" @click="emit('cancel')">cancel</button>
      <button type="button" class="sn-primary" :disabled="saving || !body.trim()" @click="submit">
        {{ props.submitLabel ?? "Reply" }}
      </button>
    </div>
  </div>
</template>
