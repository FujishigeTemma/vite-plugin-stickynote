import { createApp } from "vue";
import { createApi } from "./api.ts";
import { createOverlayCache } from "./cache.ts";
import { removeHighlight } from "./highlight.ts";
import { createStore } from "./state.ts";
import App from "./components/App.vue";
import type { OverlayOptions } from "../options.ts";

declare global {
  // eslint-disable-next-line no-var
  var __STICKYNOTE_MOUNT__: (() => void) | undefined;
}

// Idempotent: HMR re-evaluates this module, so a previous mount is detected
// via the global stash and torn down first.
export function mount(options: OverlayOptions): { unmount: () => void } {
  globalThis.__STICKYNOTE_MOUNT__?.();

  const host = document.createElement("div");
  host.id = "stickynote-overlay-root";
  host.setAttribute("data-stickynote-ignore", "");
  // `all:revert` resets host-page inheritance (font, color) so overlay text
  // looks consistent regardless of cascade. Component styles re-establish
  // what we want inside.
  host.style.cssText = "all:revert;";
  document.body.appendChild(host);

  const api = createApi(options.apiUrl, () => options.devBearer);
  const store = createStore(options, api);
  const cache = createOverlayCache();

  const app = createApp(App, { store, cache });

  (window as unknown as { __STICKYNOTE__?: unknown }).__STICKYNOTE__ = store;

  try {
    app.mount(host);
    console.log("[stickynote] overlay mounted. Press Cmd/Ctrl + . to toggle.");
  } catch (err) {
    console.error("[stickynote] failed to mount overlay", err);
  }

  const unmount = (): void => {
    app.unmount();
    host.remove();
    removeHighlight();
    delete (window as unknown as { __STICKYNOTE__?: unknown }).__STICKYNOTE__;
    globalThis.__STICKYNOTE_MOUNT__ = undefined;
  };

  globalThis.__STICKYNOTE_MOUNT__ = unmount;
  return { unmount };
}
