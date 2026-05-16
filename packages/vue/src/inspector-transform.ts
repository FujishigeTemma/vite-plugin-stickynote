import path from "node:path";
import process from "node:process";
import { parse as parseTemplate, transform as transformTemplate } from "@vue/compiler-dom";
import MagicString from "magic-string";
import { normalizePath, type Plugin } from "vite";

// Minimal SFC-template source attribution. Walks each `.vue` file's template
// AST and inserts `data-v-inspector="path:line"` on every element so the
// overlay can map DOM nodes back to source. Carved out of
// vite-plugin-vue-inspector (MIT, webfansplz) — kept only the Vue 3 template
// branch, no JSX / vapor / inspector-UI / Vue 2 / appendTo / `_interopVNode`
// rewrite, because the overlay reads the attribute directly off the DOM.

const KEY_DATA = "data-v-inspector";
const EXCLUDE_TAG = new Set(["template", "script", "style"]);
const NODE_TYPE_ELEMENT = 1;

export function inspectorTransform(root: string): Plugin {
  return {
    name: "stickynote:inspector-transform",
    enforce: "pre",
    apply(_, { command }) {
      return command === "serve" && process.env.NODE_ENV !== "test";
    },
    transform(code, id) {
      const [filename, rawQuery] = id.split("?", 2);
      if (!filename || !filename.endsWith(".vue")) return null;
      const query = new URLSearchParams(rawQuery ?? "");
      // Skip <style> blocks and `?raw` requests — only the template body needs
      // the attribute injection.
      if (query.get("type") === "style") return null;
      if (query.has("raw")) return null;

      const s = new MagicString(code);
      // Path is relative to the git repo root so it lines up with the GitHub
      // tree across monorepo packages (e.g. `apps/website/src/Foo.vue`).
      const relativePath = normalizePath(path.relative(root, filename));
      const ast = parseTemplate(code, { comments: true });

      transformTemplate(ast, {
        nodeTransforms: [
          (node) => {
            if (node.type !== NODE_TYPE_ELEMENT) return;
            if (EXCLUDE_TAG.has(node.tag)) return;
            // Idempotent: skip if already tagged (e.g. re-transform on HMR).
            if (node.loc.source.includes(KEY_DATA)) return;
            const insertPosition =
              node.props.length > 0
                ? Math.max(...node.props.map((p) => p.loc.end.offset))
                : node.loc.start.offset + node.tag.length + 1;
            const { line } = node.loc.start;
            s.prependLeft(insertPosition, ` ${KEY_DATA}="${relativePath}:${line}"`);
          },
        ],
      });

      if (!s.hasChanged()) return null;
      return { code: s.toString(), map: s.generateMap({ hires: "boundary" }) };
    },
  };
}
