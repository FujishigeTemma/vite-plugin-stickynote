<script setup lang="ts">
import { useThreadsList } from "../composables.ts";
import Pin from "./Pin.vue";

const { visible } = useThreadsList();
</script>

<template>
  <Pin v-for="thread in visible" :key="thread.id" :thread="thread" />
</template>
