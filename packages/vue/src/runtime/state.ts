import { ref, shallowRef } from "vue";

import type { OverlayOptions } from "../options.ts";
import { type ElementMap } from "./inspector.ts";

// Plain reactive refs for everything that isn't server state. Server state
// (threads / comments / me) lives in TanStack Query; UI flags, DOM-tracker
// values, and the static mount options have no fetch / staleness / GC story,
// so a cache layer would be pure overhead.

// UI state.
export const active = ref(false);
export const panelOpen = ref(false);
export const showResolved = ref(false);
export const openThreadId = ref<string | null>(null);
export const currentRoute = ref<string>(window.location.pathname);

// DOM-tracker outputs (written by dom-tracker.ts, read by Pin/Inspector).
// `shallowRef` so identity-change is the only re-render trigger.
export const tick = shallowRef(0);
export const elementMap = shallowRef<ElementMap>(new Map());

// Static mount options. Seeded by overlay.ts before App.vue mounts; readers
// see a value from the first render.
export const options = shallowRef<OverlayOptions | null>(null);

// Panel-open and thread-selection are one invariant: closing the panel
// always discards the currently-open thread. Centralising it keeps callers
// from poking `panelOpen` directly.
export function closePanel(): void {
  panelOpen.value = false;
  openThreadId.value = null;
}

export function togglePanel(): void {
  if (panelOpen.value) closePanel();
  else panelOpen.value = true;
}

export function openThread(id: string | null): void {
  openThreadId.value = id;
  if (id) panelOpen.value = true;
}

export function toggleActive(): void {
  active.value = !active.value;
  if (!active.value) closePanel();
}
