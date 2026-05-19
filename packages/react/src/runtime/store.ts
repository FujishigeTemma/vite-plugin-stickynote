import { create } from "zustand";

import type { OverlayOptions } from "../options.ts";

// One Zustand store for everything that isn't server state. Server state
// (threads / comments / me) lives in TanStack Query; UI flags, DOM-tracker
// values, and the static mount options have no fetch / staleness / GC story,
// so a cache layer would be pure overhead.
//
// The store is subscribable from non-React code (dom-tracker, route-tracker,
// host-router) — that's the reason it's Zustand rather than plain React
// state + Context. `useStore.setState({...})` and
// `useStore.subscribe(selector, fn)` both work outside the React tree.

export type State = {
  // UI state.
  active: boolean;
  panelOpen: boolean;
  showResolved: boolean;
  openThreadId: string | null;
  currentRoute: string;
  // True once we've decided no TanStack Router instance is reachable. Surfaced
  // in the status bar so a misconfigured host doesn't silently save threads
  // under the initial pathname.
  noRouter: boolean;
  // Bumped by dom-tracker when the host DOM gains or loses an inspector-
  // tagged element. Sole trigger for re-resolving (path, line, index) → live
  // element bindings; position follow-through is handled by CSS Anchor
  // Positioning.
  domVersion: number;
  // Static mount options. Seeded by overlay.tsx before App.tsx mounts; readers
  // see a value from the first render.
  options: OverlayOptions | null;
};

export type Actions = {
  closePanel: () => void;
  togglePanel: () => void;
  openThread: (id: string | null) => void;
  toggleActive: () => void;
  setShowResolved: (next: boolean) => void;
  bumpDomVersion: () => void;
  setCurrentRoute: (route: string) => void;
  setNoRouter: (next: boolean) => void;
  setOptions: (options: OverlayOptions | null) => void;
};

export const useStore = create<State & Actions>((set) => ({
  active: false,
  panelOpen: false,
  showResolved: false,
  openThreadId: null,
  currentRoute: typeof window !== "undefined" ? window.location.pathname : "/",
  noRouter: false,
  domVersion: 0,
  options: null,

  // Panel-open and thread-selection are one invariant: closing the panel
  // always discards the currently-open thread. Centralising it keeps callers
  // from poking `panelOpen` directly.
  closePanel: () => set({ panelOpen: false, openThreadId: null }),
  togglePanel: () =>
    set((s) => (s.panelOpen ? { panelOpen: false, openThreadId: null } : { panelOpen: true })),
  openThread: (id) => set(id ? { openThreadId: id, panelOpen: true } : { openThreadId: null }),
  toggleActive: () =>
    set((s) =>
      s.active ? { active: false, panelOpen: false, openThreadId: null } : { active: true },
    ),
  setShowResolved: (next) => set({ showResolved: next }),
  bumpDomVersion: () => set((s) => ({ domVersion: s.domVersion + 1 })),
  setCurrentRoute: (route) => set({ currentRoute: route }),
  setNoRouter: (next) => set({ noRouter: next }),
  setOptions: (options) => set({ options }),
}));
