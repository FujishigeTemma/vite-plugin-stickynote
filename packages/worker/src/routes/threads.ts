import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import { newCommentId, newComponentId, newThreadId, nowISO } from "../id.ts";
import { commentsRoutes } from "./comments.ts";
import {
  CreateThreadSchema,
  ListThreadsQuerySchema,
  ThreadIdParamSchema,
  UpdateThreadPositionSchema,
  UpdateThreadStatusSchema,
} from "../schemas.ts";
import type {
  Comment,
  CommentRow,
  Component,
  ComponentRow,
  Env,
  ThreadRow,
  Variables,
} from "../types.ts";

// SQLite has no JSON type, so json_group_array returns a TEXT string — D1
// can't auto-parse it. Instead, fetch relations in second queries and group
// in JS; the response then carries `components: Component[]` and
// `first_comment: Comment` natively, so Hono RPC infers the shape end-to-end.

// D1's bound-parameter ceiling is ~100; chunk lookups so a large list query
// can't trip it once the dataset grows.
const IN_CHUNK = 90;

function stripThreadId<T extends { thread_id: string }>(row: T): Omit<T, "thread_id"> {
  const { thread_id: _, ...rest } = row;
  return rest;
}

function hydrate(threads: ThreadRow[], components: ComponentRow[], firstComments: CommentRow[]) {
  const componentsByThread = new Map<string, Component[]>();
  for (const c of components) {
    const arr = componentsByThread.get(c.thread_id);
    const entry = stripThreadId(c);
    if (arr) arr.push(entry);
    else componentsByThread.set(c.thread_id, [entry]);
  }
  const firstCommentByThread = new Map<string, Comment>();
  for (const c of firstComments) firstCommentByThread.set(c.thread_id, stripThreadId(c));
  return threads.flatMap((t) => {
    const first_comment = firstCommentByThread.get(t.id);
    // Live threads always have a head comment (deleting it cascades the
    // thread). A missing row means the thread was deleted between the two
    // queries — drop it from the response rather than ship a half-built row.
    if (!first_comment) return [];
    return [{ ...t, components: componentsByThread.get(t.id) ?? [], first_comment }];
  });
}

async function loadComponentsFor(env: Env, threadIds: string[]): Promise<ComponentRow[]> {
  if (threadIds.length === 0) return [];
  const out: ComponentRow[] = [];
  for (let i = 0; i < threadIds.length; i += IN_CHUNK) {
    const chunk = threadIds.slice(i, i + IN_CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT * FROM components WHERE thread_id IN (${placeholders}) ORDER BY thread_id, display_order ASC`,
    )
      .bind(...chunk)
      .all<ComponentRow>();
    out.push(...results);
  }
  return out;
}

async function loadFirstCommentsFor(env: Env, threadIds: string[]): Promise<CommentRow[]> {
  if (threadIds.length === 0) return [];
  const out: CommentRow[] = [];
  for (let i = 0; i < threadIds.length; i += IN_CHUNK) {
    const chunk = threadIds.slice(i, i + IN_CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT id, thread_id, body, created_by, created_by_name, created_at, updated_at, deleted_at
       FROM (
         SELECT c.*, ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY created_at ASC, id ASC) AS rn
         FROM comments c
         WHERE c.thread_id IN (${placeholders})
       ) WHERE rn = 1`,
    )
      .bind(...chunk)
      .all<CommentRow>();
    out.push(...results);
  }
  return out;
}

async function loadHydratedThread(env: Env, threadId: string) {
  const [thread, components, firstComments] = await Promise.all([
    env.DB.prepare(`SELECT * FROM threads WHERE id = ?`).bind(threadId).first<ThreadRow>(),
    loadComponentsFor(env, [threadId]),
    loadFirstCommentsFor(env, [threadId]),
  ]);
  if (!thread) return null;
  return hydrate([thread], components, firstComments)[0] ?? null;
}

export const threadsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>()
  .get("/", vValidator("query", ListThreadsQuerySchema), async (c) => {
    const { route, includeResolved, q } = c.req.valid("query");
    const where: string[] = [];
    const binds: unknown[] = [];
    if (route) {
      where.push("t.route = ?");
      binds.push(route);
    }
    if (includeResolved !== "true") {
      where.push("t.status = 'open'");
    }
    const trimmedQ = q?.trim();
    if (trimmedQ) {
      // Escape LIKE metacharacters so a user typing `100%` or `_id` searches
      // for the literal text instead of triggering wildcards.
      const pattern = `%${trimmedQ.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      where.push(
        "EXISTS (SELECT 1 FROM comments c WHERE c.thread_id = t.id AND c.deleted_at IS NULL AND c.body LIKE ? ESCAPE '\\')",
      );
      binds.push(pattern);
    }
    const sql = `SELECT * FROM threads t ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY t.created_at DESC`;
    const { results } = await c.env.DB.prepare(sql)
      .bind(...binds)
      .all<ThreadRow>();
    const ids = results.map((t) => t.id);
    const [components, firstComments] = await Promise.all([
      loadComponentsFor(c.env, ids),
      loadFirstCommentsFor(c.env, ids),
    ]);
    return c.json({ threads: hydrate(results, components, firstComments) });
  })
  .post("/", vValidator("json", CreateThreadSchema), async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const threadId = newThreadId().toString();
    const commentId = newCommentId().toString();
    const now = nowISO();

    const statements = [
      c.env.DB.prepare(
        `INSERT INTO threads (
          id, route, url,
          commit_hash, dirty_build, x_ratio, y_ratio, viewport_w, viewport_h,
          status, created_by, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
      ).bind(
        threadId,
        body.route,
        body.url,
        body.commit_hash,
        body.dirty_build ? 1 : 0,
        body.x_ratio,
        body.y_ratio,
        body.viewport_w,
        body.viewport_h,
        user.sub,
        user.name,
        now,
        now,
      ),
      c.env.DB.prepare(
        `INSERT INTO comments (id, thread_id, body, created_by, created_by_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(commentId, threadId, body.body, user.sub, user.name, now, now),
    ];

    for (let i = 0; i < body.components.length; i++) {
      const comp = body.components[i];
      if (!comp) continue;
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO components (id, thread_id, display_order, path, line, v_for_index, name)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          newComponentId().toString(),
          threadId,
          i,
          comp.path,
          comp.line,
          comp.v_for_index,
          comp.name,
        ),
      );
    }

    await c.env.DB.batch(statements);

    const [thread, comments] = await Promise.all([
      loadHydratedThread(c.env, threadId),
      c.env.DB.prepare("SELECT * FROM comments WHERE thread_id = ? ORDER BY created_at ASC")
        .bind(threadId)
        .all<CommentRow>(),
    ]);
    if (!thread) throw new Error("inserted thread vanished from DB");
    return c.json({ thread, comments: comments.results }, 201);
  })
  .get("/:threadId", vValidator("param", ThreadIdParamSchema), async (c) => {
    const { threadId } = c.req.valid("param");
    const [thread, comments] = await Promise.all([
      loadHydratedThread(c.env, threadId),
      c.env.DB.prepare("SELECT * FROM comments WHERE thread_id = ? ORDER BY created_at ASC")
        .bind(threadId)
        .all<CommentRow>(),
    ]);
    if (!thread) return c.json({ error: "not_found" }, 404);
    return c.json({ thread, comments: comments.results });
  })
  .patch(
    "/:threadId/status",
    vValidator("param", ThreadIdParamSchema),
    vValidator("json", UpdateThreadStatusSchema),
    async (c) => {
      const { threadId } = c.req.valid("param");
      const { status } = c.req.valid("json");
      const result = await c.env.DB.prepare(
        "UPDATE threads SET status = ?, updated_at = ? WHERE id = ?",
      )
        .bind(status, nowISO(), threadId)
        .run();
      if (!result.meta.changes) return c.json({ error: "not_found" }, 404);
      // Client invalidates the threads list on success and ignores the body,
      // so skip the read-after-write round-trip.
      return c.json({ ok: true });
    },
  )
  .patch(
    "/:threadId/position",
    vValidator("param", ThreadIdParamSchema),
    vValidator("json", UpdateThreadPositionSchema),
    async (c) => {
      const { threadId } = c.req.valid("param");
      const { x_ratio, y_ratio } = c.req.valid("json");
      const result = await c.env.DB.prepare(
        "UPDATE threads SET x_ratio = ?, y_ratio = ?, updated_at = ? WHERE id = ?",
      )
        .bind(x_ratio, y_ratio, nowISO(), threadId)
        .run();
      if (!result.meta.changes) return c.json({ error: "not_found" }, 404);
      return c.json({ ok: true });
    },
  )
  .delete("/:threadId", vValidator("param", ThreadIdParamSchema), async (c) => {
    const user = c.get("user");
    const { threadId } = c.req.valid("param");
    const thread = await c.env.DB.prepare("SELECT created_by FROM threads WHERE id = ?")
      .bind(threadId)
      .first<{ created_by: string }>();
    if (!thread) return c.json({ error: "not_found" }, 404);
    if (thread.created_by !== user.sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    await c.env.DB.prepare("DELETE FROM threads WHERE id = ?").bind(threadId).run();
    return c.json({ ok: true });
  })
  .route("/:threadId/comments", commentsRoutes);
