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

pnpm + Vite+ monorepo with three workspaces. The runtime composition matters more than the file tree:

- **`packages/vue`** — the published Vite plugin `@vite-plugin-stickynote/vue`. `stickynote()` returns **two** plugins:
  1. `inspectorTransform` (`enforce: "pre"`) rewrites every non-`node_modules` `.vue` template, inserting `data-v-inspector="<repo-relative-path>:<line>"` on each element. Repo-relative paths come from `git rev-parse --show-toplevel`, so monorepo packages emit paths GitHub can resolve (`apps/website/src/Foo.vue`, not `src/Foo.vue`).
  2. `overlayPlugin` injects a `<script type="module">` into `index.html` (in `transformIndexHtml` with `order: "pre"`, so Vite's HTML scan picks it up at build time). The script imports `virtual:stickynote-mount.js`, which boots the overlay runtime from `packages/vue/src/runtime/` via `virtual:stickynote-path:<rel>` virtual IDs.

  The runtime ships **as source** (`files: ["dist", "src"]` in package.json; entry exports come from `dist/`, but virtual-module IDs `load()` directly off disk from `src/runtime/`). This is intentional: the consumer's own `@vitejs/plugin-vue` compiles the SFCs, so `<style scoped>` and SFC features work natively without CSS-in-JS or Shadow DOM.

- **`packages/worker`** — private (`@vite-plugin-stickynote/worker`). Hono app at `src/index.ts`: CORS middleware → `/api/*` mounted with `requireAuth()` → routes for `threads` and `comments`. D1 schema in `migrations/0001_init.sql`; soft-delete on `comments` (cascades through `threads` if the first comment is deleted). Deployed once per consumer to their own Cloudflare account.

- **`apps/website`** — example consumer for local dev. Wires `vue-router/vite` + `@vitejs/plugin-vue` + `stickynote({ apiUrl: "http://localhost:8787", devBearer: "stickynote-dev-token" })`. The `server.watch.ignored: ["!**/node_modules/@vite-plugin-stickynote/vue/**"]` un-ignore is required so edits to the linked plugin's runtime trigger HMR.

# Activation rule (easy to miss)

The plugin's built-in `apply` only self-skips when `mode === "production"` (the literal default of bare `vite build`). For any other mode label — including `prod`, `release`, `dev` — the consumer must gate the plugin in `vite.config.ts`:

```ts
mode !== "prod" && stickynote({ ... })
```

Without the conditional, `vite build --mode prod` ships the overlay. The README/packages/vue/README spell this out; preserve the pattern in examples.

# Auth model

Three paths in `requireAuth` (`packages/worker/src/auth.ts`), checked in this order:

- **Local dev**: if `DEV_BEARER` is set in the worker env, accept a static bearer. Production never sets it.
- **AI agent (PAT)**: if the bearer starts with `st_pat_`, look up `agent_tokens.token_hash` (SHA-256). One token per user; the Panel UI's "AI access" section issues/revokes. Author name surfaces as `<name> (AI)` so agent-posted comments are visually distinct. Run `vpx @vite-plugin-stickynote/cli usage` for the agent-facing API guide.
- **Deployed (human)**: Clerk JWT. The user's `fullName` is cached in the `users` table (24h TTL) to avoid hitting `clerk.users.getUser()` on every poll.

PAT inherits all the owner's permissions (read, comment, resolve, delete). Revoke from the Panel if leaked.

# Common commands

`vp` distinguishes **direct subcommands** (`vp check`, `vp test`, `vp build`, `vp fmt`, `vp lint`) from **task runs** (`vp run [-r] <task>`, which executes a `scripts` entry defined in a workspace `package.json`). Selector flags like `-r` go **before** the task name: `vp run -r build`, not `vp run build -r`.

```bash
vp install            # install workspace deps (run after pulling)
vp run website#dev    # apps/website on :5173 (also: `pnpm dev` at root, same thing)
vp check              # fmt + lint + type-check at the repo root
vp run -r build       # build every package that defines a `build` script
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
