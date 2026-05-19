import { defineConfig } from "vite-plus";

export default defineConfig({
  // Only the Node-side plugin is bundled. The runtime under `src/runtime/`
  // ships as source and is loaded into the consumer via virtual modules so
  // CSS modules and TSX are compiled by the consumer's React plugin.
  pack: {
    entry: ["src/index.ts", "src/client.ts"],
    format: ["esm"],
    dts: true,
    platform: "node",
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
