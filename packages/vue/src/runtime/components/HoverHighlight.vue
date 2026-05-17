<script setup lang="ts">
import { computed } from "vue";

// Pure CSS-anchored hover rectangle. The active highlight target is
// communicated by stamping `anchor-name: --sn-hover` onto the element being
// hovered (Inspector.vue owns that toggle); the browser then resizes /
// repositions this box for free via `anchor()` / `anchor-size()`.
//
// Two label modes share the rect:
// - "info" (default): component name + source path
// - "jump" (Cmd/Ctrl held): preview of the GitHub destination
// A clickable link in the label is impractical because the rect follows the
// cursor; the modifier preview reveals the destination instead.
export type HoverInfo =
  | { mode: "info"; name: string; source: string | null }
  | { mode: "jump"; source: string; commit: string };

const props = defineProps<{ info: HoverInfo | null }>();

const visible = computed(() => props.info !== null);
</script>

<template>
  <template v-if="visible">
    <div class="sn-hover" data-stickynote-ignore />
    <div class="sn-hover-card" data-stickynote-ignore>
      <template v-if="props.info?.mode === 'info'">
        <span class="sn-hover-name">&lt;{{ props.info.name }}&gt;</span>
        <span v-if="props.info.source">{{ props.info.source }}</span>
      </template>
      <template v-else-if="props.info?.mode === 'jump'">
        <span>jump to </span>
        <span class="sn-hover-link"
          >{{ props.info.source }}[{{ props.info.commit.slice(0, 7) }}]</span
        >
      </template>
    </div>
  </template>
</template>

<style scoped>
.sn-hover {
  position: fixed;
  position-anchor: --sn-hover;
  left: anchor(left);
  top: anchor(top);
  width: anchor-size(width);
  height: anchor-size(height);
  background-color: rgba(139, 92, 246, 0.08);
  border: 2px solid #8b5cf6;
  border-radius: 2px;
  box-sizing: border-box;
  pointer-events: none;
  transition: all 60ms linear;
}
.sn-hover-card {
  position: fixed;
  position-anchor: --sn-hover;
  /* Default: sit above the rect's top-left. Browser auto-flips below when
     the card would clip the top of the viewport (the `position-try`
     fallback). No JS measurement needed. */
  left: anchor(left);
  bottom: anchor(top);
  margin-bottom: 4px;
  position-try-fallbacks: --sn-hover-card-below;
  display: flex;
  gap: 8px;
  align-items: center;
  white-space: nowrap;
  pointer-events: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 4px;
  color: #fff;
  background-color: #1f2937;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
@position-try --sn-hover-card-below {
  bottom: auto;
  top: anchor(bottom);
  margin-bottom: 0;
  margin-top: 4px;
}
.sn-hover-name {
  color: #c4b5fd;
}
.sn-hover-link {
  color: #93c5fd;
  text-decoration: underline;
}
</style>
