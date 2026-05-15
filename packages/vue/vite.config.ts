import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: [
    {
      entry: ["src/index.ts"],
      format: ["esm"],
      dts: true,
      platform: "node",
    },
    {
      entry: { "runtime/overlay": "src/runtime/overlay.ts" },
      format: ["esm"],
      dts: true,
      // Browser target so Vue resolves to its ESM-bundler build instead of
      // the CJS one (which pulls `createRequire` from `node:module` and
      // blows up in the browser). `fixedExtension` keeps the output as
      // `.mjs`/`.d.mts` — without it, browser platform defaults to `.js`.
      platform: "browser",
      fixedExtension: true,
      // Bundle vue into the overlay so the consumer's Vue version cannot
      // collide with ours. The two reactive scopes are isolated.
      deps: {
        alwaysBundle: [
          "vue",
          "@vue/runtime-core",
          "@vue/runtime-dom",
          "@vue/shared",
          "@vue/reactivity",
        ],
      },
      plugins: [vue()],
    },
  ],
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
