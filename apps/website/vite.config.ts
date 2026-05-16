import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import stickynote from "vite-plugin-stickynote";
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
});
