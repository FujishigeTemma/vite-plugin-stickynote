import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/runtime/overlay.ts"],
    format: ["esm"],
    dts: true,
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
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
