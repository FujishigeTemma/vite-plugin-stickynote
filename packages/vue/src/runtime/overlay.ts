import { createApp } from "vue";
import App from "./components/App.vue";
import { OVERLAY_CSS } from "./styles.ts";
import type { OverlayOptions } from "../options.ts";

let mounted = false;

// The overlay lives inside a closed-styled Shadow DOM so host CSS cannot leak
// in and our CSS cannot leak out. The host element covers the viewport but is
// transparent to pointer events; interactive children opt back in via CSS.
export function mount(options: OverlayOptions): void {
  if (mounted) return;
  mounted = true;

  const host = document.createElement("div");
  host.id = "stickynote-overlay-root";
  // `all:initial` first so it doesn't override the layout properties below.
  // Shadow DOM isolates rules, but inheritable properties (font, color)
  // still flow from the host element into shadow descendants.
  host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000;";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = OVERLAY_CSS;
  shadow.appendChild(style);
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  try {
    createApp(App, { options }).mount(mountPoint);
    console.log("[stickynote] overlay mounted. Press Cmd/Ctrl + . to toggle.");
  } catch (err) {
    console.error("[stickynote] failed to mount overlay", err);
  }
}
