# vite-plugin-stickynote

In-app comment overlay for Vue dev environments. Pin coordinates, threads, and replies are persisted via a Cloudflare Worker + D1, so PMs / designers / QA can leave feedback directly on the running app without opening DevTools.

- **Vite plugin** (`@vite-plugin-stickynote/vue`) — injects the overlay into your dev server
- **Cloudflare Worker** (`packages/worker`) — Hono + D1 + Clerk JWT, deployed to your own CF account

## Quick start

### 1. Deploy the Worker

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/FujishigeTemma/vite-plugin-stickynote&workerDirectory=packages/worker)

The button forks the repo, provisions a D1 database, and deploys `packages/worker` to your account. Then finish three things by hand:

1. `wrangler secret put CLERK_SECRET_KEY` — paste your Clerk **secret** key.
2. Update `vars.ALLOWED_ORIGINS` in `wrangler.jsonc` (or the dashboard) to your dev origin(s), then redeploy.
3. Copy the deployed Worker URL — you'll pass it to the Vite plugin as `apiUrl`.

Full breakdown (including manual `wrangler` fallback when the button doesn't fit your workflow) is in [packages/worker/DEPLOY.md](packages/worker/DEPLOY.md).

### 2. Install the plugin

```bash
pnpm add -D @vite-plugin-stickynote/vue
```

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
      githubRepo: "<owner>/<repo>", // optional — enables "open on GitHub" links
    }),
  ],
});
```

Run `vp dev` and toggle the overlay with the plugin's keybind. See [packages/vue/README.md](packages/vue/README.md) for the full options table.

## Local development of this repo

```bash
vp install       # install workspace deps
vp run dev       # runs apps/website against a local wrangler dev worker
vp run check     # format, lint, type check
vp run test -r   # unit tests across the workspace
vp run build -r  # build all packages
```

The local website (`apps/website`) talks to `wrangler dev` on `http://localhost:8787` and uses a static dev bearer instead of Clerk. See [packages/worker/.dev.vars.example](packages/worker/.dev.vars.example).

## Repository layout

```
packages/
  vue/      — @vite-plugin-stickynote/vue (the Vite plugin + runtime overlay)
  worker/   — Cloudflare Worker (Hono + D1 + Clerk), deployed per-consumer
apps/
  website/  — example consumer used during local development
```
