# AI agent access

Stickynote threads and comments are accessible to AI agents through the same
REST API the browser overlay uses. This guide is for an agent operating
against a deployed worker; local-dev workers use `DEV_BEARER`.

## 1. Issue a token

1. Open your stickynote-instrumented app in a browser, open the panel.
2. Under **AI access**, click **generate token**.
3. Copy the `st_pat_...` string immediately. It is shown only once.

There is exactly one token per user. Regenerating invalidates the previous one.
Revoking removes it entirely. The token inherits all owner permissions: read,
comment, resolve, and delete.

## 2. Set environment variables

```sh
export STICKYNOTE_API_URL="https://<your-worker>.workers.dev"
export STICKYNOTE_TOKEN="st_pat_..."
```

## 3. CLI

Use `@vite-plugin-stickynote/cli`; it uses the worker's Hono RPC contract and
reads `STICKYNOTE_API_URL` / `STICKYNOTE_TOKEN` from the environment.

```sh
vpx @vite-plugin-stickynote/cli list
```

Commands:

```sh
# List open threads
vpx @vite-plugin-stickynote/cli list

# Include resolved threads
vpx @vite-plugin-stickynote/cli list --include-resolved

# Filter by route
vpx @vite-plugin-stickynote/cli list --route /settings

# Show one thread with comments
vpx @vite-plugin-stickynote/cli show "$ID"

# Claim a cooperative lock
vpx @vite-plugin-stickynote/cli lock "$ID" \
  --owner "agent-123" \
  --scope "settings-layout" \
  --branch "stickynote/settings-layout"

# Comment with a PR URL
vpx @vite-plugin-stickynote/cli comment "$ID" \
  "Ready for review in https://github.com/owner/repo/pull/123"

# Release a cooperative lock after opening a PR
vpx @vite-plugin-stickynote/cli unlock "$ID" \
  --owner "agent-123" \
  --scope "settings-layout" \
  --result done \
  --pr "https://github.com/owner/repo/pull/123"

# Resolve only after the PR is merged
vpx @vite-plugin-stickynote/cli resolve "$ID"
```

## 4. Workflow

1. List open threads.
2. Read `first_comment.body`, follow-up comments, and `components[0].path:line`.
3. Triage and prioritize each thread by user impact, implementation risk, code locality, and dependencies.
4. Group related threads into non-conflicting bundles.
5. Only after triage and grouping, assign each bundle to a subagent.
6. Have each subagent work in its own worktree and branch, with a disjoint bundle of threads.
7. Before editing, claim every assigned thread with `lock`; this posts a cooperative lock comment. If another active lock exists, skip the thread and report the conflict.
8. Open a PR and comment the PR URL on every covered thread.
9. Ask the user to review and merge the PR; keep covered threads open during review.
10. Resolve each thread only after the corresponding PR has been merged.

## 5. Notes

- Agent-posted comments are stored with the author name suffixed `(AI)`.
- Tokens cannot mint or revoke other tokens; use the panel UI for that.
- If a token leaks, revoke it from the panel.
- The worker logs `last_used_at` on each PAT request.
