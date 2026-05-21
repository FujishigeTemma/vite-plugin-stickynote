# AI agent access

Stickynote threads and comments are accessible to AI agents (e.g. Claude Code)
through the same REST API the browser overlay uses. This guide is for an
**agent operating against a deployed worker**; local-dev workers use
`DEV_BEARER` and don't need any of this.

## 1. Issue a token

1. Open your stickynote-instrumented app in a browser, open the panel.
2. Under **AI access**, click **generate token**.
3. Copy the `st_pat_...` string immediately — it is shown only once.

There is exactly one token per user. Clicking **regenerate** invalidates the
previous one. **Revoke** removes it entirely. The token inherits all of your
permissions (read, comment, resolve, **and delete**) — treat it as a password.

## 2. Set environment variables

```sh
export STICKYNOTE_API_URL="https://<your-worker>.workers.dev"
export STICKYNOTE_TOKEN="st_pat_..."
```

## 3. Endpoints

All require `Authorization: Bearer $STICKYNOTE_TOKEN`. Responses are JSON.

| Method | Path                                 | Purpose                                          |
| ------ | ------------------------------------ | ------------------------------------------------ |
| GET    | `/api/threads?includeResolved=false` | List threads (open by default)                   |
| GET    | `/api/threads/:threadId`             | Thread detail + components + comments            |
| POST   | `/api/threads/:threadId/comments`    | Add a comment (body: `{ "body": "..." }`)        |
| PATCH  | `/api/threads/:threadId/status`      | Mark resolved (body: `{ "status": "resolved" }`) |

Each thread carries a `components[]` array — `path` is repo-relative and
`line` points at the source location. That's enough to locate code without any
extra mapping.

Agent-posted comments are stored with the author name suffixed `(AI)` so
humans can tell them apart in the panel.

## 4. Recommended workflow

1. `GET /api/threads?includeResolved=false` — list open threads.
2. For each thread, read `body` (or `first_comment.body`) and
   `components[0].path:line`. Open the file, fix the issue.
3. `gh pr create` (or your equivalent) — get the PR URL.
4. `POST /api/threads/:id/comments` with body `Fixed in <PR URL>`.
5. `PATCH /api/threads/:id/status` with `{"status":"resolved"}`.

## 5. curl reference

```sh
# List
curl "$STICKYNOTE_API_URL/api/threads?includeResolved=false" \
  -H "Authorization: Bearer $STICKYNOTE_TOKEN"

# Comment
curl -X POST "$STICKYNOTE_API_URL/api/threads/$ID/comments" \
  -H "Authorization: Bearer $STICKYNOTE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Fixed in https://github.com/owner/repo/pull/123"}'

# Resolve
curl -X PATCH "$STICKYNOTE_API_URL/api/threads/$ID/status" \
  -H "Authorization: Bearer $STICKYNOTE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved"}'
```

## 6. Notes

- Tokens cannot be used to mint or revoke other tokens — only the Panel UI
  (Clerk-authed) can.
- If a token leaks, revoke it from the Panel; in-flight agent requests will
  fail with 401 on the next call.
- The worker logs `last_used_at` on each PAT request — check the Panel to
  spot unexpected activity.
