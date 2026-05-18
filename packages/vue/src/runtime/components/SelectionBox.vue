<script setup lang="ts">
import { useAnchorBinding } from "../anchor-binding.ts";
import type { Component } from "../types.ts";

// One selection rectangle, anchored to a single component occurrence. Lives
// as a separate component so `useAnchorBinding` can be called once per
// `v-for` item — composables can only be invoked in setup, not inside loops
// of a parent setup.
const props = defineProps<{
  component: Pick<Component, "path" | "line" | "v_for_index">;
  anchorName: string;
  label: string;
}>();

const { element } = useAnchorBinding(() => props.component, props.anchorName);
</script>

<template>
  <template v-if="element">
    <div class="sn-sel" data-stickynote-ignore :style="{ positionAnchor: props.anchorName }" />
    <div class="sn-sel-label" data-stickynote-ignore :style="{ positionAnchor: props.anchorName }">
      {{ props.label }}
    </div>
  </template>
</template>

<style scoped>
.sn-sel {
  position: fixed;
  left: anchor(left);
  top: anchor(top);
  width: anchor-size(width);
  height: anchor-size(height);
  border: 2px solid var(--sn-selection-border);
  border-radius: 2px;
  background-color: var(--sn-selection-bg);
  box-sizing: border-box;
  pointer-events: none;
  transition: all 60ms linear;
}
.sn-sel-label {
  position: fixed;
  left: anchor(left);
  bottom: anchor(top);
  margin-bottom: 2px;
  position-try-fallbacks: --sn-sel-label-below;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 3px;
  color: var(--sn-selection-label-fg);
  background-color: var(--sn-selection-label-bg);
  box-shadow: var(--sn-shadow-sm);
  white-space: nowrap;
  pointer-events: none;
}
@position-try --sn-sel-label-below {
  bottom: auto;
  top: anchor(bottom);
  margin-bottom: 0;
  margin-top: 2px;
}
</style>
