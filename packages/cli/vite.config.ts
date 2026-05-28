import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    platform: "node",
    plugins: [
      {
        name: "stickynote-cli-raw",
        async load(id) {
          const [filename, query] = id.split("?", 2);
          if (query !== "raw" || !filename) return null;
          const text = await fs.readFile(path.resolve(filename), "utf8");
          return `export default ${JSON.stringify(text)};`;
        },
      },
    ],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
