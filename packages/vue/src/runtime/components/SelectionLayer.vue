<script setup lang="ts">
import { computed } from "vue";

import { useThreadsList } from "../composables.ts";
import { componentAnchorName, componentKey } from "../inspector.ts";
import { openThreadId } from "../state.ts";
import type { Component } from "../types.ts";
import SelectionBox from "./SelectionBox.vue";

// Renders selection boxes for whichever source is "active":
//   - the composer's in-progress component picks (passed via prop)
//   - else the currently-open thread's components
// Composer takes priority — Inspector.vue passes its picks in; we fall back
// to the open thread otherwise.
const props = defineProps<{
  composerPicks: Pick<Component, "path" | "line" | "v_for_index" | "name">[];
}>();

const { threads } = useThreadsList();

const items = computed<Pick<Component, "path" | "line" | "v_for_index" | "name">[]>(() => {
  if (props.composerPicks.length > 0) return props.composerPicks;
  const openId = openThreadId.value;
  if (!openId) return [];
  const thread = threads.value.find((t) => t.id === openId);
  return thread?.components ?? [];
});
</script>

<template>
  <SelectionBox
    v-for="(item, i) in items"
    :key="componentKey(item)"
    :component="item"
    :anchor-name="componentAnchorName(item)"
    :label="`${i === 0 ? '★ ' : ''}${item.name}`"
  />
</template>
