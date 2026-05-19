import { ref, shallowRef } from "vue";

import type { OverlayOptions } from "../options.ts";

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

// True once we've decided no host vue-router is reachable. Surfaced in the
// status bar so a misconfigured host doesn't silently save threads under
// stale or initial-pathname routes.
export const noRouter = ref(false);

// Bumped by dom-tracker when the host DOM gains or loses an inspector-tagged
// element. Sole trigger for re-resolving (path, line, index) → live element
// bindings; position follow-through is handled by CSS Anchor Positioning.
export const domVersion = shallowRef(0);

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
