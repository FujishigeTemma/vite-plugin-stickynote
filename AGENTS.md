# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 設計原則

- シンプルさを最優先
- 疎結合かつ高凝集
- There should be one-- and preferably only one --obvious way to do it
- YAGNI（You Aren't Gonna Need It）を徹底
- 早すぎる最適化は避ける
- 複雑な抽象化を避け、必要最低限の本質を本質的なAPIで設計する
- composable over configuration

# Repository architecture

pnpm + Vite+ monorepo. The runtime composition matters more than the file tree:

- **`packages/vue`** — the published Vite plugin `@vite-plugin-stickynote/vue`. `stickynote()` returns **two** plugins:
  1. `inspectorTransform` (`enforce: "pre"`) rewrites every non-`node_modules` `.vue` template, inserting `data-v-inspector="<repo-relative-path>:<line>"` on each element. Repo-relative paths come from `git rev-parse --show-toplevel`, so monorepo packages emit paths GitHub can resolve (`examples/vue/src/Foo.vue`, not `src/Foo.vue`).
  2. `overlayPlugin` injects a `<script type="module">` into `index.html` (in `transformIndexHtml` with `order: "pre"`, so Vite's HTML scan picks it up at build time). The script imports `virtual:stickynote-mount.js`, which boots the overlay runtime from `packages/vue/src/runtime/` via `virtual:stickynote-path:<rel>` virtual IDs.

  The runtime ships **as source** (`files: ["dist", "src"]` in package.json; entry exports come from `dist/`, but virtual-module IDs `load()` directly off disk from `src/runtime/`). This is intentional: the consumer's own `@vitejs/plugin-vue` compiles the SFCs, so `<style scoped>` and SFC features work natively without CSS-in-JS or Shadow DOM.

- **`packages/react`** — the published Vite plugin `@vite-plugin-stickynote/react`. React 19 + TanStack Router. Same two-plugin shape as the Vue version:
  1. `inspectorTransform` walks `.jsx` / `.tsx` files with `@babel/parser` + `@babel/traverse` and inserts `data-react-inspector="<repo-relative-path>:<line>"` on every **intrinsic** (lowercase) JSXOpeningElement. Custom components are skipped because they may not forward `data-*` props.
  2. `overlayPlugin` is the verbatim Vue-side scaffold (virtual modules + `transformIndexHtml`). The mount entry is `runtime/overlay.tsx` (React 19 `createRoot` into a `document.body`-appended div — the same pattern React DevTools' own Highlighter uses).

  Host-router integration uses **TanStack Router's `window.__TSR_ROUTER__` singleton** and `router.subscribe('onResolved', fn)`. No DevTools hook required — the React DevTools hook path needs to patch the reconciler at boot, which a runtime-injected overlay can't do.

  State: Zustand (`runtime/store.ts`). Server cache: `@tanstack/react-query`. Component-name resolution: the stable `__reactFiber$<id>` property-key walk (`runtime/react-instance.ts`), with memo/forwardRef unwrapping matching React DevTools' own `getDisplayNameForFiber`.

- **`packages/worker`** — private (`@vite-plugin-stickynote/worker`). Hono app at `src/index.ts`: CORS middleware → `/api/*` mounted with `requireAuth()` → routes for `threads` and `comments`. D1 schema in `migrations/0001_init.sql`; soft-delete on `comments` (cascades through `threads` if the first comment is deleted). Deployed once per consumer to their own Cloudflare account. **Both `packages/vue` and `packages/react` talk to the same worker over the same endpoints** — the wire schema is defined here and inferred via Hono's `InferRequestType` / `InferResponseType` in both plugin runtimes.

- **`examples/vue`** — example Vue consumer for local dev. Wires `vue-router/vite` + `@vitejs/plugin-vue` + `stickynote({ apiUrl: "http://localhost:8787", devBearer: "stickynote-dev-token" })`. The `server.watch.ignored: ["!**/node_modules/@vite-plugin-stickynote/vue/**"]` un-ignore is required so edits to the linked plugin's runtime trigger HMR.

- **`examples/react`** — example React consumer. Wires `@tanstack/router-plugin/vite` (file-based routing under `src/routes/`) + `@vitejs/plugin-react-oxc` + `stickynote(...)`. The router plugin generates `src/routeTree.gen.ts` on Vite startup; that file is gitignored. Same `server.watch.ignored` un-ignore as the Vue example, but pointed at `@vite-plugin-stickynote/react`.

# Activation rule (easy to miss)

The plugin's built-in `apply` only self-skips when `mode === "production"` (the literal default of bare `vite build`). For any other mode label — including `prod`, `release`, `dev` — the consumer must gate the plugin in `vite.config.ts`:

```ts
mode !== "prod" && stickynote({ ... })
```

Without the conditional, `vite build --mode prod` ships the overlay. The README/packages/vue/README spell this out; preserve the pattern in examples.

# Auth model

Two paths, mutually exclusive:

- **Deployed builds**: host app calls `setAuthSource(() => clerkSessionToken)` from `@vite-plugin-stickynote/vue/client` (or `@vite-plugin-stickynote/react/client`). The runtime reads the getter per-request; Worker verifies the Clerk JWT. The two `setAuthSource` exports write to the same `globalThis.__STICKYNOTE_AUTH_SOURCE__` slot — they're framework-agnostic by design.
- **Local dev only**: Worker runs with accepts a static `DEV_BEARER`. The plugin's `devBearer` option ships that token to the bundle — **never set it for any build that leaves your machine**, even a dev-mode CI deploy.

# Common commands

`vp` distinguishes **direct subcommands** (`vp check`, `vp test`, `vp build`, `vp fmt`, `vp lint`) from **task runs** (`vp run [-r] <task>`, which executes a `scripts` entry defined in a workspace `package.json`). Selector flags like `-r` go **before** the task name: `vp run -r build`, not `vp run build -r`.

```bash
vp install                  # install workspace deps (run after pulling)
vp run example-react#dev    # examples/react on :5173 (also: `pnpm dev` at root)
vp run example-vue#dev      # examples/vue on :5173 (or `pnpm dev:vue` at root)
vp check                    # fmt + lint + type-check at the repo root
vp run -r build             # build every package that defines a `build` script
```

There are currently no test files in the workspace; `vp test` runs but exits 1 with "No test files found". The `pnpm ready` script in root `package.json` references nonexistent `test` / `build` tasks via `vp run` and will fail until those are added — don't rely on it as a green light.

Worker (always start in a second terminal before running the website):

```bash
pnpm --filter @vite-plugin-stickynote/worker dev               # wrangler dev on :8787
pnpm --filter @vite-plugin-stickynote/worker db:migrate:local  # apply migrations to local D1
pnpm --filter @vite-plugin-stickynote/worker db:reset:local    # wipe local D1, re-apply migrations
pnpm --filter @vite-plugin-stickynote/worker cf-typegen        # regenerate Cloudflare Env types
```

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.

<!--VITE PLUS END-->
