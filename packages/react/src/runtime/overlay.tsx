import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import type { OverlayOptions } from "../options.ts";
import { clearAPIClient, initAPIClient } from "./api-client.ts";
import App from "./components/App.tsx";
import { installHostRouterSubscription } from "./host-router.ts";
import { queryClient } from "./query-client.ts";
import { useStore } from "./store.ts";

declare global {
  // eslint-disable-next-line no-var
  var __STICKYNOTE_MOUNT__: (() => void) | undefined;
}

// Idempotent: HMR re-evaluates this module, so a previous mount is detected
// via the global stash and torn down first.
//
// Mounts a separate React root into an overlay div appended to document.body
// — the same pattern React DevTools' own Highlighter uses
// (`react-devtools-shared/src/backend/views/Highlighter/Overlay.js:176`:
// `doc.body.appendChild(this.container)`). Living outside the host React
// tree means we keep working when the host app crashes and have no way to
// pollute its Suspense / Error boundary flow.
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

  // Deployed builds register a Clerk JWT via setAuthSource(); devBearer is
  // the local-dev fallback used when no source is registered.
  initAPIClient(opts.apiUrl, opts.devBearer);
  useStore.getState().setOptions(opts);

  const detachRouter = installHostRouterSubscription();

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    );
    console.log("[stickynote] overlay mounted. Press Cmd/Ctrl + . to toggle.");
  } catch (err) {
    console.error("[stickynote] failed to mount overlay", err);
  }

  (window as unknown as { __STICKYNOTE__?: unknown }).__STICKYNOTE__ = { queryClient };

  const unmount = (): void => {
    detachRouter();
    root?.unmount();
    host.remove();
    clearAPIClient();
    queryClient.clear();
    useStore.getState().setOptions(null);
    delete (window as unknown as { __STICKYNOTE__?: unknown }).__STICKYNOTE__;
    globalThis.__STICKYNOTE_MOUNT__ = undefined;
  };

  globalThis.__STICKYNOTE_MOUNT__ = unmount;
  return { unmount };
}
