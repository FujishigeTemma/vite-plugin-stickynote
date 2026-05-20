import path from "node:path";
import process from "node:process";
import { parse } from "@babel/parser";
import * as _traverseNS from "@babel/traverse";
import type { NodePath, TraverseOptions } from "@babel/traverse";
import type { JSXOpeningElement, Node as BabelNode } from "@babel/types";
import MagicString from "magic-string";
import { normalizePath, type Plugin } from "vite";

// JSX source-attribution. Walks every `.jsx` / `.tsx` file and inserts
// `data-react-inspector="path:line"` on each **intrinsic** (lowercase)
// opening element so the overlay can map DOM nodes back to source.
// Custom components are skipped because they may not forward `data-*`
// props to a DOM node — each rendered DOM element should carry exactly
// one inspector attribute from the deepest intrinsic JSX site that
// produced it, matching the Vue plugin's per-DOM-element granularity.

// `@babel/traverse` ships as CJS — under ESM `import` it lands as
// `{ default: traverse }` at runtime, but `@types/babel__traverse`
// declares the default export as a namespace (object), so a plain
// default-import is rejected by TS as "not callable". Unwrap via the
// namespace import + a narrow callable type so both ESM-loader and
// CJS-loader builds work.
type TraverseFn = (root: BabelNode, opts: TraverseOptions) => void;
const traverse: TraverseFn =
  (_traverseNS as unknown as { default: TraverseFn }).default ??
  (_traverseNS as unknown as TraverseFn);

const KEY_DATA = "data-react-inspector";

export function inspectorTransform(root: string): Plugin {
  return {
    name: "stickynote:inspector-transform",
    enforce: "pre",
    apply(_, { mode }) {
      return mode !== "production" && process.env.NODE_ENV !== "test";
    },
    transform(code, id) {
      const [filename, rawQuery] = id.split("?", 2);
      if (!filename) return null;
      if (!/\.(jsx|tsx)$/.test(filename)) return null;
      // Skip third-party JSX — inspector paths would point at non-existent
      // entries in the consumer's repo tree.
      if (filename.includes("/node_modules/")) return null;
      const query = new URLSearchParams(rawQuery ?? "");
      if (query.has("raw")) return null;
      // Cheap pre-filter: only parse files that actually contain a JSX
      // opening tag. The opening "<" + identifier check eliminates pure
      // utility modules that just happen to be .tsx.
      if (!/<[A-Za-z]/.test(code)) return null;

      let ast;
      try {
        ast = parse(code, {
          sourceType: "module",
          allowImportExportEverywhere: true,
          allowReturnOutsideFunction: true,
          errorRecovery: true,
          plugins: ["jsx", "typescript"],
        });
      } catch {
        // Bail silently on parse errors — let the consumer's React plugin
        // surface the real diagnostic from its own pass.
        return null;
      }

      const s = new MagicString(code);
      // Path is relative to the git repo root so it lines up with the GitHub
      // tree across monorepo packages (e.g. `examples/react/src/Foo.tsx`).
      const relativePath = normalizePath(path.relative(root, filename));

      traverse(ast, {
        JSXOpeningElement(p: NodePath<JSXOpeningElement>) {
          const node = p.node;
          const name = node.name;
          // Only `<div>`, `<span>`, etc. JSXIdentifier with lowercase first
          // char. Skip `<Foo/>`, `<Foo.Bar/>`, `<ns:foo/>`, fragments.
          if (name.type !== "JSXIdentifier") return;
          if (!/^[a-z]/.test(name.name)) return;

          const startOff = node.start;
          const endOff = node.end;
          if (startOff == null || endOff == null) return;
          // Idempotent: skip if already tagged (HMR re-transform).
          if (s.original.slice(startOff, endOff).includes(KEY_DATA)) return;
          // Skip if any existing attribute is literally the inspector key
          // — covers user-written tags too.
          for (const attr of node.attributes) {
            if (
              attr.type === "JSXAttribute" &&
              attr.name.type === "JSXIdentifier" &&
              attr.name.name === KEY_DATA
            ) {
              return;
            }
          }

          const line = node.loc?.start.line;
          if (line == null) return;

          // Insert at the end of the last attribute, or just after the tag
          // name if there are no attributes. Matches the Vue version's
          // insertion strategy so quoting / whitespace stays predictable.
          const lastAttr = node.attributes[node.attributes.length - 1];
          const insertAt = lastAttr && lastAttr.end != null ? lastAttr.end : (name.end ?? startOff);
          s.appendRight(insertAt, ` ${KEY_DATA}="${relativePath}:${line}"`);
        },
      });

      if (!s.hasChanged()) return null;
      return { code: s.toString(), map: s.generateMap({ hires: "boundary" }) };
    },
  };
}
