<script setup lang="ts">
import { useStore } from "../store-inject.ts";
import Pin from "./Pin.vue";

const store = useStore();
</script>

<template>
  <Pin v-for="thread in store.visibleThreads.value" :key="thread.id" :thread="thread" />
</template>
