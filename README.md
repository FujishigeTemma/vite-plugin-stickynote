# vite-plugin-stickynote

In-app comment overlay for non-production builds of a Vue app. Pin coordinates, threads, and replies are persisted via a Cloudflare Worker + D1, so PMs / designers / QA can leave feedback directly on a running dev-mode deploy (e.g. a `vite build --mode dev` shipped to a staging origin behind Clerk + Cloudflare Tunnel) without opening DevTools. Local `vite dev` is the same flow, just hosted on `localhost`.

- **Vite plugin** (`@vite-plugin-stickynote/vue`) — injects the overlay into any non-production build (dev server _or_ `vite build --mode dev`)
- **Cloudflare Worker** (`packages/worker`) — Hono + D1 + Clerk JWT, deployed to your own CF account

## Quick start

### 1. Deploy the Worker

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/FujishigeTemma/vite-plugin-stickynote&workerDirectory=packages/worker)

The button forks the repo, provisions a D1 database, and deploys `packages/worker` to your account. Then finish three things by hand:

1. `wrangler secret put CLERK_SECRET_KEY` — paste your Clerk **secret** key.
2. Update `vars.ALLOWED_ORIGINS` in `wrangler.jsonc` (or the dashboard) to the origin(s) where your dev-mode build is served (e.g. `https://platform.p8n.dev` for a Cloudflare-hosted staging site, plus `http://localhost:5173` for local), then redeploy.
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

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // Include the overlay in any build that isn't your prod build.
    // Adjust the label ("prod" / "production" / "release" / ...) to match
    // whatever `--mode` your prod pipeline uses.
    mode !== "prod" &&
      stickynote({
        apiUrl: "https://stickynote-worker.<your-subdomain>.workers.dev",
        githubRepo: "<owner>/<repo>", // optional — enables "open on GitHub" links
      }),
  ],
}));
```

**Activation.** The plugin self-skips only when Vite's mode is the literal string `"production"` (the default of `vite build` with no flag). For any other mode label, your `vite.config.ts` decides — that's why the snippet above is conditional. Without the conditional, a `vite build --mode prod` would still ship the overlay.

### 3. Wire the auth source

The Worker rejects requests that don't carry a Clerk JWT. In the host app's entry, register a getter so the overlay can read the current session token at request time:

```ts
// main.ts (or wherever your app boots)
import { setAuthSource } from "@vite-plugin-stickynote/vue/client";

setAuthSource(() => window.Clerk?.session?.getToken() ?? null);
```

Registration order is not load-bearing — the auth source is read per-request, so it just needs to be set before someone opens the overlay.

## Deploying with the overlay

The primary use case is **CI-deployed dev builds**: the team's main branch lands on a non-production environment (e.g. `https://platform.p8n.dev`), Clerk gates access to internal users, and PMs / designers / QA leave comments directly on that running site. A representative pipeline (mirroring `console/.github/workflows/deploy-frontend.yml`):

```yaml
# .github/workflows/deploy-frontend.yml
env:
  NODE_ENV: production       # Vite/Rollup minify both modes
- run: vp build --mode dev   # → mode === "dev" → overlay included
- run: wrangler deploy --env dev
```

Things to double-check before shipping a dev build:

- **CORS** — the deployed origin must be in the Worker's `ALLOWED_ORIGINS`.
- **`devBearer` must be unset** — it's serialized into the bundle and would be readable by anyone who can load the page. It exists only for talking to a local `wrangler dev` Worker running in `CLERK_ISSUER=dev` mode. Real deploys use `setAuthSource` + Clerk JWT.
- **Git metadata** — the plugin runs `git rev-parse HEAD` at config time to stamp each pin with a commit hash (and `git status --porcelain` for a dirty flag). CI runners that do a normal `actions/checkout` are fine; shallow `git archive` extracts are not.

Open the deployed dev site (or run `vp dev` locally) and toggle the overlay with the plugin's keybind. See [packages/vue/README.md](packages/vue/README.md) for the full options table.

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
