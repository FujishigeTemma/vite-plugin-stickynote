import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin, type PluginOption } from "vite";
import { inspectorTransform } from "./inspector-transform.ts";
import type { OverlayOptions, StickynoteOptions } from "./options.ts";

export type { OverlayOptions, StickynoteOptions } from "./options.ts";

export default function stickynote(options: StickynoteOptions): PluginOption {
  const meta = readGitMeta();
  return [inspectorTransform(meta.root), overlayPlugin(options, meta)];
}

// The runtime ships as source files (under `src/runtime/`) and is compiled by
// the consumer's Vite + @vitejs/plugin-vue. This lets SFC `<style scoped>`
// work natively — no CSS-in-JS workaround, no Shadow DOM.
//
// Virtual modules drive the entry point so the consumer doesn't need to know
// any path. `virtual:stickynote-path:<rel>` resolves to the absolute source
// file; `load` reads it from disk directly so Vite's `fs.allow` restrictions
// don't block files outside the consumer's project root.
const RUNTIME_ROOT = normalizePath(path.resolve(fileURLToPath(import.meta.url), "../../src"));
const VIRTUAL_MOUNT = "virtual:stickynote-mount.js";
const VIRTUAL_PATH_PREFIX = "virtual:stickynote-path:";

function overlayPlugin(
  opts: StickynoteOptions,
  meta: { commit: string; dirty: boolean; root: string },
): Plugin {
  return {
    name: "@vite-plugin-stickynote/vue",
    // Self-skip only Vite's default production build (`vite build` with no
    // `--mode`). Any other mode label is the consumer's territory — they
    // compose conditionally in `vite.config.ts`, e.g.
    // `mode !== "prod" && stickynote(...)`.
    apply: (_, { mode }) => mode !== "production",
    resolveId(id) {
      if (id === VIRTUAL_MOUNT) return id;
      if (id.startsWith(VIRTUAL_PATH_PREFIX)) {
        return `${RUNTIME_ROOT}/${id.slice(VIRTUAL_PATH_PREFIX.length)}`;
      }
      return null;
    },
    async load(id) {
      if (id === VIRTUAL_MOUNT) {
        const init: OverlayOptions = {
          apiUrl: stripTrailingSlash(opts.apiUrl),
          githubRepo: opts.githubRepo ?? null,
          commitHash: meta.commit,
          dirtyBuild: meta.dirty,
          devBearer: opts.devBearer ?? null,
        };
        return [
          `import { mount } from "virtual:stickynote-path:runtime/overlay.ts";`,
          `mount(${JSON.stringify(init)});`,
        ].join("\n");
      }
      // Read source files for any id rooted inside our runtime tree. This
      // catches both the entry (resolved above) and its relative imports
      // (e.g. `./components/App.vue`), which Vite resolves to absolute paths
      // under the same root.
      if (id.startsWith(RUNTIME_ROOT)) {
        const [filename, rawQuery] = id.split("?", 2);
        if (!filename) return null;
        // Let @vitejs/plugin-vue handle SFC sub-requests (`?vue&type=...`).
        if (rawQuery && new URLSearchParams(rawQuery).has("vue")) return null;
        if (fs.existsSync(filename)) {
          return await fs.promises.readFile(filename, "utf-8");
        }
      }
      return null;
    },
    transformIndexHtml: {
      // `pre` runs before Vite's own HTML build plugin, which scans inline
      // module-scripts and bundles their content via `html-proxy`. That scan
      // resolves the bare `import "virtual:..."` through this plugin's
      // `resolveId`/`load` and emits a real chunk. Post-ordered hooks miss
      // the scan and would leak the literal `virtual:` string into output.
      order: "pre",
      handler(_, ctx) {
        if (ctx.server) {
          return [
            {
              tag: "script",
              attrs: { type: "module", src: `/@id/${VIRTUAL_MOUNT}` },
              injectTo: "body",
            },
          ];
        }
        return [
          {
            tag: "script",
            attrs: { type: "module" },
            children: `import "${VIRTUAL_MOUNT}";`,
            injectTo: "body",
          },
        ];
      },
    },
  };
}

function readGitMeta(): { commit: string; dirty: boolean; root: string } {
  try {
    const commit = execSync("git rev-parse HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const status = execSync("git status --porcelain", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    // Repo root, so inspector paths are relative to the GitHub tree (not the
    // package cwd). Without this, monorepo packages emit paths like
    // `src/Foo.vue` while GitHub expects `apps/website/src/Foo.vue`.
    const root = execSync("git rev-parse --show-toplevel", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return { commit, dirty: status.length > 0, root };
  } catch {
    // Not in a git repo, or git missing. Treat as dirty so the GitHub link
    // is hidden / flagged rather than pointing at the wrong commit.
    return { commit: "unknown", dirty: true, root: process.cwd() };
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
