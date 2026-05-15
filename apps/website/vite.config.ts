import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import stickynote from "vite-plugin-stickynote";

export default defineConfig({
  plugins: [
    vue(),
    stickynote({
      apiUrl: "http://localhost:8787",
      githubRepo: "FUJISHIGE-temma/vite-plugin-stickynote",
      // Local-dev only. Matches DEV_BEARER in apps/worker/.dev.vars.
      devBearer: "stickynote-dev-token",
    }),
  ],
});
