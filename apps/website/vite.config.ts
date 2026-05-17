import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import stickynote from "@vite-plugin-stickynote/vue";
import VueRouter from "vue-router/vite";

export default defineConfig({
  plugins: [
    VueRouter({ routesFolder: "src/pages" }),
    vue(),
    stickynote({
      apiUrl: "http://localhost:8787",
      githubRepo: "FUJISHIGE-temma/vite-plugin-stickynote",
      // Local-dev only. Matches DEV_BEARER in packages/worker/.dev.vars.
      devBearer: "stickynote-dev-token",
    }),
  ],
  server: {
    // The plugin resolves through a pnpm workspace symlink, and Vite's watcher
    // skips node_modules by default. Un-ignore the linked package so edits to
    // its runtime sources (served via virtual modules) trigger HMR.
    watch: {
      ignored: ["!**/node_modules/@vite-plugin-stickynote/vue/**"],
    },
  },
});
