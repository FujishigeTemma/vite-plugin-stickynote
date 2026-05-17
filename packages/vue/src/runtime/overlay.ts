import { VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";

import type { OverlayOptions } from "../options.ts";
import { clearAPIClient, initAPIClient } from "./api-client.ts";
import App from "./components/App.vue";
import { queryClient } from "./query-client.ts";
import { options } from "./state.ts";

declare global {
  // eslint-disable-next-line no-var
  var __STICKYNOTE_MOUNT__: (() => void) | undefined;
}

// Idempotent: HMR re-evaluates this module, so a previous mount is detected
// via the global stash and torn down first.
export function mount(opts: OverlayOptions): { unmount: () => void } {
  globalThis.__STICKYNOTE_MOUNT__?.();

  const host = document.createElement("div");
  host.id = "stickynote-overlay-root";
  host.setAttribute("data-stickynote-ignore", "");
  // `all:revert` resets host-page inheritance (font, color) so overlay text
  // looks consistent regardless of cascade. Component styles re-establish
  // what we want inside.
  host.style.cssText = "all:revert;";
  document.body.appendChild(host);

  initAPIClient(opts.apiUrl, () => opts.devBearer);
  options.value = opts;

  const app = createApp(App);
  app.use(VueQueryPlugin, { queryClient });

  (window as unknown as { __STICKYNOTE__?: unknown }).__STICKYNOTE__ = { queryClient };

  try {
    app.mount(host);
    console.log("[stickynote] overlay mounted. Press Cmd/Ctrl + . to toggle.");
  } catch (err) {
    console.error("[stickynote] failed to mount overlay", err);
  }

  const unmount = (): void => {
    app.unmount();
    host.remove();
    clearAPIClient();
    queryClient.clear();
    options.value = null;
    delete (window as unknown as { __STICKYNOTE__?: unknown }).__STICKYNOTE__;
    globalThis.__STICKYNOTE_MOUNT__ = undefined;
  };

  globalThis.__STICKYNOTE_MOUNT__ = unmount;
  return { unmount };
}
