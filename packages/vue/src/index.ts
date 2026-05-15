import { execSync } from "node:child_process";
import type { Plugin, PluginOption } from "vite";
import * as VueInspectorMod from "vite-plugin-vue-inspector";
import type { OverlayOptions, StickynoteOptions } from "./options.ts";

export type { OverlayOptions, StickynoteOptions } from "./options.ts";

// vite-plugin-vue-inspector ships only a CJS-flavored .d.ts; under
// nodenext + verbatimModuleSyntax the default export resolves to a namespace.
// Normalize both ESM-default and CJS-namespace shapes here.
type VueInspectorFn = (options?: { enabled?: boolean }) => PluginOption;
const vueInspector: VueInspectorFn = ((VueInspectorMod as { default?: unknown }).default ??
  VueInspectorMod) as VueInspectorFn;

export default function stickynote(options: StickynoteOptions): PluginOption {
  const meta = readGitMeta();
  return [
    // PLAN 7.9: vite-plugin-vue-inspector is required for component
    // identification. Bundle it structurally so consumers cannot forget it.
    vueInspector({ enabled: true }),
    overlayPlugin(options, meta),
  ];
}

// Virtual module the consumer's browser imports. Putting the mount call
// behind a virtual module (instead of an inline `<script>` with a bare
// specifier) lets Vite resolve and pre-bundle "vite-plugin-stickynote/runtime/
// overlay" through its normal pipeline — inline bare imports never resolve
// in the browser. We avoid the `\0` resolved-id convention because URL
// round-tripping for `__x00`-prefixed ids is brittle across Vite versions.
const VIRTUAL_ID = "virtual:stickynote-mount.js";

function overlayPlugin(opts: StickynoteOptions, meta: { commit: string; dirty: boolean }): Plugin {
  return {
    name: "vite-plugin-stickynote",
    apply: "serve",
    resolveId(id) {
      if (id === VIRTUAL_ID || id.endsWith(VIRTUAL_ID)) return VIRTUAL_ID;
      return null;
    },
    load(id) {
      if (id !== VIRTUAL_ID) return null;
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
          attrs: { type: "module", src: `/@id/${VIRTUAL_ID}` },
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
