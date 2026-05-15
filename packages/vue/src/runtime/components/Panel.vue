<script setup lang="ts">
import { useStore } from "../store-inject.ts";
import ThreadDetail from "./ThreadDetail.vue";
import ThreadList from "./ThreadList.vue";

const store = useStore();

function close(): void {
  store.panelOpen.value = false;
}

function toggleResolved(): void {
  store.showResolved.value = !store.showResolved.value;
  void store.refreshThreads();
}
</script>

<template>
  <aside v-if="store.panelOpen.value" class="sn-panel">
    <header class="sn-panel-header">
      <h2>{{ store.openThreadId.value ? "Thread" : "Threads" }}</h2>
      <div class="sn-panel-actions">
        <button
          v-if="!store.openThreadId.value"
          type="button"
          :class="{ 'sn-active': store.showResolved.value }"
          @click="toggleResolved"
        >
          show resolved
        </button>
        <button type="button" @click="close">close</button>
      </div>
    </header>
    <div class="sn-panel-body">
      <ThreadDetail v-if="store.openThreadId.value" />
      <ThreadList v-else />
    </div>
  </aside>
</template>
