<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "../store-inject.ts";

const store = useStore();

const dirtyBadge = computed(() => (store.options.dirtyBuild ? "local changes" : null));
const shortCommit = computed(() => store.options.commitHash.slice(0, 7));

function togglePanel(): void {
  store.panelOpen.value = !store.panelOpen.value;
}

function toggleInspect(): void {
  store.mode.value = store.mode.value === "inspecting" ? "idle" : "inspecting";
}
</script>

<template>
  <div class="sn-statusbar">
    <span class="sn-title">stickynote</span>
    <span v-if="dirtyBadge" class="sn-badge">{{ dirtyBadge }}</span>
    <span class="sn-commit">{{ shortCommit }}</span>
    <button
      type="button"
      :class="{ 'sn-active': store.mode.value === 'inspecting' }"
      title="Toggle inspector"
      @click="toggleInspect"
    >
      pin
    </button>
    <button
      type="button"
      :class="{ 'sn-active': store.panelOpen.value }"
      title="Toggle panel"
      @click="togglePanel"
    >
      threads
    </button>
  </div>
</template>
