<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";

import { serverMutations } from "../mutations.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";

const meQ = useQuery(serverQueries.me(), queryClient);
const { data: token } = useQuery(serverQueries.agentToken(), queryClient);
const generate = useMutation(serverMutations.agentToken.generate(), queryClient);
const revoke = useMutation(serverMutations.agentToken.revoke(), queryClient);

// Loading and error are surfaced as their own states so a real Clerk user
// doesn't see the "sign in with Clerk" hint while /api/me is still in
// flight (or just failed). Treat undefined data + isPending as loading;
// only show the dev-bearer hint when the response is definitively the
// dev user.
const me = computed(() => meQ.data.value);
const isLoadingMe = computed(() => meQ.isPending.value && !meQ.data.value);
const isErrorMe = computed(
  () => !meQ.isPending.value && (meQ.isError.value || meQ.data.value == null),
);
const isDevUser = computed(() => me.value?.sub === "dev_user");
const isClerkUser = computed(() => me.value != null && me.value.sub !== "dev_user");

const justIssued = ref<string | null>(null);
const copied = ref(false);

async function onGenerate(): Promise<void> {
  const res = await generate.mutateAsync();
  justIssued.value = res.token;
  copied.value = false;
}

async function onCopy(): Promise<void> {
  if (!justIssued.value) return;
  await navigator.clipboard.writeText(justIssued.value);
  copied.value = true;
}

function onDismiss(): void {
  justIssued.value = null;
}

async function onRevoke(): Promise<void> {
  if (!window.confirm("Revoke your AI access token? Existing agents will lose access.")) return;
  await revoke.mutateAsync();
  justIssued.value = null;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString();
}
</script>

<template>
  <section class="sn-agent-token">
    <h3 class="sn-section-title">AI access</h3>

    <p v-if="isLoadingMe" class="sn-token-hint">loading…</p>

    <p v-else-if="isErrorMe" class="sn-token-hint">
      Couldn't reach the worker to check your identity. Token management is unavailable until the
      connection recovers.
    </p>

    <p v-else-if="isDevUser" class="sn-token-hint">
      The local-dev bearer doesn't have a Clerk identity to attach a token to. Sign in with Clerk in
      a deployed environment to issue an AI agent token.
    </p>

    <template v-if="isClerkUser">
      <div v-if="justIssued" class="sn-token-issued">
        <p class="sn-token-hint">Copy this token now — it won't be shown again.</p>
        <div class="sn-token-row">
          <code class="sn-token">{{ justIssued }}</code>
          <button type="button" @click="onCopy">{{ copied ? "copied" : "copy" }}</button>
        </div>
        <div class="sn-form-actions">
          <button type="button" @click="onDismiss">done</button>
        </div>
      </div>

      <div v-else-if="token?.exists" class="sn-token-meta">
        <div>Generated {{ fmt(token.created_at) }}</div>
        <div>Last used {{ fmt(token.last_used_at) }}</div>
        <div class="sn-form-actions">
          <button type="button" :disabled="generate.isPending.value" @click="onGenerate">
            regenerate
          </button>
          <button type="button" :disabled="revoke.isPending.value" @click="onRevoke">revoke</button>
        </div>
      </div>

      <div v-else class="sn-token-empty">
        <p class="sn-token-hint">
          Issue a token to let an AI agent read and resolve threads via the HTTP API.
        </p>
        <button type="button" :disabled="generate.isPending.value" @click="onGenerate">
          generate token
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.sn-agent-token {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sn-section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--sn-text-muted);
  margin: 0 0 4px;
}
.sn-token-hint {
  color: var(--sn-text-muted);
  font-size: 12px;
  margin: 0;
}
.sn-token-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sn-token {
  flex: 1;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  background: var(--sn-surface-raised);
  padding: 6px 8px;
  border-radius: 6px;
  overflow-wrap: anywhere;
  user-select: all;
}
.sn-token-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--sn-text-muted);
}
.sn-token-empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sn-form-actions {
  display: flex;
  gap: 6px;
}
button {
  border: 1px solid var(--sn-border);
  background: var(--sn-surface);
  color: var(--sn-text);
  padding: 4px 8px;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}
button:hover:not(:disabled) {
  background: var(--sn-surface-raised);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
