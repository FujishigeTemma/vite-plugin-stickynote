import { execSync } from "node:child_process";
import type { Plugin, PluginOption } from "vite";
import { inspectorTransform } from "./inspector-transform.ts";
import type { OverlayOptions, StickynoteOptions } from "./options.ts";

export type { OverlayOptions, StickynoteOptions } from "./options.ts";

export default function stickynote(options: StickynoteOptions): PluginOption {
  const meta = readGitMeta();
  return [inspectorTransform(), overlayPlugin(options, meta)];
}

// Vite's standard virtual module convention. `\0` marks the id as
// plugin-owned so other plugins skip it; Vite serves it through `/@id/__x00...`
// in the browser, with the bare specifier inside resolved by Vite's normal
// module pipeline. Inlining the script body instead would bypass that
// pipeline and the bare specifier would leak to the browser unresolved.
const RESOLVED_ID = "\0virtual:stickynote-mount.js";
const VIRTUAL_ID = "virtual:stickynote-mount.js";

function overlayPlugin(opts: StickynoteOptions, meta: { commit: string; dirty: boolean }): Plugin {
  return {
    name: "vite-plugin-stickynote",
    apply: "serve",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const init: OverlayOptions = {
        apiUrl: stripTrailingSlash(opts.apiUrl),
        githubRepo: opts.githubRepo ?? null,
        commitHash: meta.commit,
        dirtyBuild: meta.dirty,
        devBearer: opts.devBearer ?? null,
      };
      return [
        `import { mount } from "vite-plugin-stickynote/runtime/overlay";`,
        `mount(${JSON.stringify(init)});`,
      ].join("\n");
    },
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { type: "module", src: `/@id/__x00__${VIRTUAL_ID}` },
          injectTo: "body",
        },
      ];
    },
  };
}

function readGitMeta(): { commit: string; dirty: boolean } {
  try {
    const commit = execSync("git rev-parse HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const status = execSync("git status --porcelain", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    return { commit, dirty: status.length > 0 };
  } catch {
    // Not in a git repo, or git missing. Treat as dirty so the GitHub link
    // is hidden / flagged rather than pointing at the wrong commit.
    return { commit: "unknown", dirty: true };
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
