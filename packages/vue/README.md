# @vite-plugin-stickynote/vue

Vite plugin that injects an in-app comment overlay into non-production builds of a Vue 3 app. The primary target is **dev-mode CI deploys** — sites built with `vite build --mode dev` and shipped to a staging origin behind Clerk + Cloudflare Tunnel. Local `vite dev` is the same flow on `localhost`. Pins, threads, and replies are persisted via a Cloudflare Worker you deploy to your own account — see the [repo README](../../README.md) for the one-click Worker deploy.

## Install

```bash
pnpm add -D @vite-plugin-stickynote/vue
```

Peer deps: `vite ^5 || ^6 || ^7`, `vue ^3.5`, `@vitejs/plugin-vue ^5 || ^6`.

## Usage

```ts
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import stickynote from "@vite-plugin-stickynote/vue";

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // Match the label your prod pipeline uses (`prod`, `production`, ...).
    mode !== "prod" &&
      stickynote({
        apiUrl: "https://stickynote-worker.<your-subdomain>.workers.dev",
        githubRepo: "acme/web",
      }),
  ],
}));
```

The plugin's built-in `apply` only excludes the literal `mode === "production"` (Vite's default for `vite build` with no flag). For any other mode label your project uses for production, gate the plugin via a `mode !== "<label>" && stickynote(...)` composition in `vite.config.ts`. This is the canonical pattern — without it, `vite build --mode prod` would still ship the overlay.

### Auth source (Clerk)

The Worker rejects requests without a valid Clerk JWT. Register an auth source from the host app's entry:

```ts
// main.ts
import { setAuthSource } from "@vite-plugin-stickynote/vue/client";

setAuthSource(() => window.Clerk?.session?.getToken() ?? null);
```

Registration order is not load-bearing — the auth source is read per-request, so it just needs to be set before the user opens the overlay. Call `setAuthSource(null)` to clear it (e.g. after sign-out).

## Options

| Option       | Type     | Required | Description                                                                                                                                                                                                                                                                            |
| ------------ | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiUrl`     | `string` | yes      | Base URL of the deployed Worker (no trailing slash). E.g. `https://stickynote-worker.<sub>.workers.dev`.                                                                                                                                                                               |
| `githubRepo` | `string` | no       | `owner/name` form. When set, the overlay renders "open on GitHub" links pinned to the commit hash of the build.                                                                                                                                                                        |
| `devBearer`  | `string` | no       | **Local `wrangler dev` only.** Static bearer the runtime falls back to when no `setAuthSource()` getter is registered. Ships in the bundle — **do not set it for any build deployed beyond your machine**, even a "dev" deploy. Real deploys must rely on `setAuthSource` + Clerk JWT. |

The source of truth for the option types is [src/options.ts](src/options.ts).

## How it works

- At config time (covers both `vite dev` and `vite build --mode dev`), the plugin reads `git rev-parse HEAD` and `git status --porcelain` to snapshot the commit + dirty flag.
- It injects a virtual module (`virtual:stickynote-mount.js`) into `index.html` that boots the overlay runtime. The HTML hook uses `/@id/...` for the dev server and the bare virtual ID for build, where Rollup resolves it through the same plugin hooks.
- The overlay calls the Worker with the host app's Clerk JWT (via `setAuthSource`) or — only when no source is registered — the static `devBearer` fallback, and persists each pin to D1.

`vite-plugin-vue-inspector` is recommended alongside this plugin so the overlay can read `data-v-inspector` attributes and resolve file path + line number per component.
