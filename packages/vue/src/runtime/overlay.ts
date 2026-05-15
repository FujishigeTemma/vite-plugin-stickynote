import { createApp } from "vue";
import App from "./components/App.vue";
import { OVERLAY_CSS } from "./styles.ts";
import type { OverlayOptions } from "../options.ts";

let mounted = false;

export function mount(options: OverlayOptions): void {
  if (mounted) return;
  mounted = true;

  console.log("[stickynote] mount", options);
  injectStyles();
  const host = document.createElement("div");
  host.id = "stickynote-overlay-root";
  document.body.appendChild(host);
  try {
    createApp(App, { options }).mount(host);
    console.log("[stickynote] overlay mounted. Press Cmd/Ctrl + . to toggle.");
  } catch (err) {
    console.error("[stickynote] failed to mount overlay", err);
  }
}

function injectStyles(): void {
  if (document.getElementById("stickynote-styles")) return;
  const style = document.createElement("style");
  style.id = "stickynote-styles";
  style.textContent = OVERLAY_CSS;
  document.head.appendChild(style);
}
