# @vite-plugin-stickynote/vue

Vite plugin that injects an in-app comment overlay into a Vue 3 dev server. Pins, threads, and replies are persisted via a Cloudflare Worker you deploy to your own account — see the [repo README](../../README.md) for the one-click Worker deploy.

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

export default defineConfig({
  plugins: [
    vue(),
    stickynote({
      apiUrl: "https://stickynote-worker.<your-subdomain>.workers.dev",
      githubRepo: "acme/web",
    }),
  ],
});
```

The plugin is `apply: "serve"` — it never ships to your production build.

## Options

| Option       | Type     | Required | Description                                                                                                                                                              |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apiUrl`     | `string` | yes      | Base URL of the deployed Worker (no trailing slash). E.g. `https://stickynote-worker.<sub>.workers.dev`.                                                                 |
| `githubRepo` | `string` | no       | `owner/name` form. When set, the overlay renders "open on GitHub" links pinned to the commit hash of the build.                                                          |
| `devBearer`  | `string` | no       | **Local dev only.** Static bearer token sent as `Authorization`. Must match the Worker's `DEV_BEARER` when its `CLERK_ISSUER=dev`. Do not set in shared/deployed builds. |

The source of truth for the option types is [src/options.ts](src/options.ts).

## How it works

- At dev-server start, the plugin reads `git rev-parse HEAD` and `git status --porcelain` to snapshot the commit + dirty flag.
- It injects a virtual module (`virtual:stickynote-mount.js`) into `index.html` that boots the overlay runtime.
- The overlay calls the Worker with the user's Clerk JWT (or the `devBearer` in local dev) and persists each pin to D1.

`vite-plugin-vue-inspector` is recommended alongside this plugin so the overlay can read `data-v-inspector` attributes and resolve file path + line number per component.
