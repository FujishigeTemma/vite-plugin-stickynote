# Deploying the Worker

The Worker is a small Hono app backed by Cloudflare D1 and gated by Clerk JWT verification. It's intended to live in **your** Cloudflare account — one Worker per team / project.

## Recommended: Deploy to Cloudflare button

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/FujishigeTemma/vite-plugin-stickynote&workerDirectory=packages/worker)

What the button does for you:

1. Forks the repo into your GitHub account.
2. Reads `packages/worker/wrangler.jsonc` and provisions a new D1 database named `stickynote` (replacing the placeholder `database_id`).
3. Applies migrations under `migrations/` to that D1 instance.
4. Deploys the Worker. The resulting URL is your `apiUrl`.

What you still need to do by hand:

### 1. Set Clerk secrets

```bash
# from packages/worker/ in your forked repo
wrangler secret put CLERK_SECRET_KEY        # paste sk_live_...
wrangler secret put CLERK_PUBLISHABLE_KEY   # paste pk_live_... (non-secret but env-specific)
```

You can also set both from the Cloudflare dashboard → your Worker → Settings → Variables and Secrets.

### 2. Restrict access by email domain

When you only want a closed set of users (e.g. employees of a single
organization) to be able to load the overlay, set `ALLOWED_EMAIL_DOMAINS`
to a comma-separated list of email domains. After Clerk JWT verification
passes, the Worker fetches the user via the Clerk backend API and allows
the request if **any** of the user's linked email addresses has a domain
on the list (not just the primary — users routinely attach a personal
address as secondary). Unmatched users are rejected with `403
forbidden_domain`. Leaving the variable unset (the default) disables the
check entirely. Lookups are cached per `userId` in-isolate for 5 minutes
so the Clerk API is hit at most once per user per cache window.

```bash
wrangler secret put ALLOWED_EMAIL_DOMAINS   # e.g. "acme.com,acme.co.jp"
```

Use `wrangler secret put` rather than committing the list to
`wrangler.jsonc` — the value isn't strictly confidential, but it leaks
who you employ if left in a public fork.

### 3. Lock down ALLOWED_ORIGINS

`vars.ALLOWED_ORIGINS` in `wrangler.jsonc` ships with `http://localhost:5173,http://localhost:5174` — fine for local, **wrong for any deployed environment**. Replace it with your real dev origin(s) (comma-separated, full origins, no trailing slash):

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://dev.acme.internal,https://preview-*.acme.internal"
}
```

Then `wrangler deploy` again. Also add the same origins to Clerk's **Allowed Origins** dashboard setting.

### 4. Wire the URL into the Vite plugin

```ts
stickynote({
  apiUrl: "https://stickynote-worker.<your-subdomain>.workers.dev",
  githubRepo: "acme/web",
});
```

Hit `/health` on the Worker URL to confirm it's live (`{ "ok": true }`), then load your Vue app — the overlay should mount.

## Manual deploy (fallback)

If the button fails or you want to deploy from your own CI:

```bash
cd packages/worker

# 1. Create a D1 database in your account and copy the printed ID.
wrangler d1 create stickynote

# 2. Paste that ID into wrangler.jsonc → d1_databases[0].database_id.

# 3. Apply migrations against the remote DB.
wrangler d1 migrations apply stickynote --remote

# 4. Deploy.
wrangler deploy

# 5. Secrets.
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_PUBLISHABLE_KEY
```

## Local dev (no Cloudflare account needed)

For working on this repo itself, `wrangler dev` runs the Worker against a local SQLite D1 and a static dev bearer — no Clerk roundtrip. See [.dev.vars.example](.dev.vars.example) and the root [README](../../README.md#local-development-of-this-repo).
