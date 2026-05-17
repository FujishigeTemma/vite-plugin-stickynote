import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import { newCommentId, newThreadId, nowISO } from "../id.ts";
import {
  CreateThreadSchema,
  IdParamSchema,
  ListThreadsQuerySchema,
  UpdateThreadPositionSchema,
  UpdateThreadStatusSchema,
} from "../schemas.ts";
import type { CommentRow, Env, ThreadRow, Variables } from "../types.ts";

type AdditionalComponent = { path: string; line: number; index: number; name: string };

// Inlines the head comment body so the list panel doesn't need a per-thread
// follow-up fetch. The subquery is index-served by comments(thread_id, created_at).
const THREAD_SELECT = `SELECT t.*, (
  SELECT body FROM comments
  WHERE thread_id = t.id
  ORDER BY created_at ASC
  LIMIT 1
) AS first_comment_body FROM threads t`;

// Hydrate the JSON-serialized additional_components column into a real array
// for the client. Returning the raw string would leak storage details into
// the hono RPC type and force every caller to JSON.parse.
function hydrateThread(row: ThreadRow) {
  const { additional_components, ...rest } = row;
  let parsed: AdditionalComponent[] = [];
  if (additional_components) {
    try {
      const v = JSON.parse(additional_components);
      if (Array.isArray(v)) parsed = v as AdditionalComponent[];
    } catch {
      parsed = [];
    }
  }
  return { ...rest, additional_components: parsed };
}

export const threadsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>()
  .get("/", vValidator("query", ListThreadsQuerySchema), async (c) => {
    const { route, includeResolved } = c.req.valid("query");
    const where: string[] = [];
    const binds: unknown[] = [];
    if (route) {
      where.push("t.route = ?");
      binds.push(route);
    }
    if (includeResolved !== "true") {
      where.push("t.status = 'open'");
    }
    const sql = `${THREAD_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY t.created_at DESC`;
    const { results } = await c.env.DB.prepare(sql)
      .bind(...binds)
      .all<ThreadRow>();
    return c.json({ threads: results.map(hydrateThread) });
  })
  .post("/", vValidator("json", CreateThreadSchema), async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const threadId = newThreadId().toString();
    const commentId = newCommentId().toString();
    const now = nowISO();

    const additionalJson =
      body.additional_components && body.additional_components.length > 0
        ? JSON.stringify(body.additional_components)
        : null;

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO threads (
          id, route, url, component_path, component_line, component_index, component_name,
          commit_hash, dirty_build, x_ratio, y_ratio, viewport_w, viewport_h,
          additional_components,
          status, created_by, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
      ).bind(
        threadId,
        body.route,
        body.url,
        body.component_path,
        body.component_line,
        body.component_index,
        body.component_name,
        body.commit_hash,
        body.dirty_build ? 1 : 0,
        body.x_ratio,
        body.y_ratio,
        body.viewport_w,
        body.viewport_h,
        additionalJson,
        user.sub,
        user.name,
        now,
        now,
      ),
      c.env.DB.prepare(
        `INSERT INTO comments (id, thread_id, body, created_by, created_by_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(commentId, threadId, body.body, user.sub, user.name, now, now),
    ]);

    const [thread, comments] = await Promise.all([
      c.env.DB.prepare(`${THREAD_SELECT} WHERE t.id = ?`).bind(threadId).first<ThreadRow>(),
      c.env.DB.prepare("SELECT * FROM comments WHERE thread_id = ? ORDER BY created_at ASC")
        .bind(threadId)
        .all<CommentRow>(),
    ]);
    return c.json(
      { thread: thread ? hydrateThread(thread) : null, comments: comments.results },
      201,
    );
  })
  .patch(
    "/:id/status",
    vValidator("param", IdParamSchema),
    vValidator("json", UpdateThreadStatusSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");
      const result = await c.env.DB.prepare(
        "UPDATE threads SET status = ?, updated_at = ? WHERE id = ?",
      )
        .bind(status, nowISO(), id)
        .run();
      if (!result.meta.changes) return c.json({ error: "not_found" }, 404);
      const thread = await c.env.DB.prepare(`${THREAD_SELECT} WHERE t.id = ?`)
        .bind(id)
        .first<ThreadRow>();
      return c.json({ thread: thread ? hydrateThread(thread) : null });
    },
  )
  .patch(
    "/:id/position",
    vValidator("param", IdParamSchema),
    vValidator("json", UpdateThreadPositionSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { x_ratio, y_ratio } = c.req.valid("json");
      const result = await c.env.DB.prepare(
        "UPDATE threads SET x_ratio = ?, y_ratio = ?, updated_at = ? WHERE id = ?",
      )
        .bind(x_ratio, y_ratio, nowISO(), id)
        .run();
      if (!result.meta.changes) return c.json({ error: "not_found" }, 404);
      const thread = await c.env.DB.prepare(`${THREAD_SELECT} WHERE t.id = ?`)
        .bind(id)
        .first<ThreadRow>();
      return c.json({ thread: thread ? hydrateThread(thread) : null });
    },
  )
  .delete("/:id", vValidator("param", IdParamSchema), async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const thread = await c.env.DB.prepare("SELECT created_by FROM threads WHERE id = ?")
      .bind(id)
      .first<{ created_by: string }>();
    if (!thread) return c.json({ error: "not_found" }, 404);
    if (thread.created_by !== user.sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    await c.env.DB.prepare("DELETE FROM threads WHERE id = ?").bind(id).run();
    return c.json({ ok: true });
  })
  .get("/:id/comments", vValidator("param", IdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM comments WHERE thread_id = ? ORDER BY created_at ASC",
    )
      .bind(id)
      .all<CommentRow>();
    return c.json({ comments: results });
  });
