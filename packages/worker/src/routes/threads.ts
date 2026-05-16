import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import { newCommentId, newThreadId, nowISO } from "../id.ts";
import {
  CreateThreadSchema,
  IdParamSchema,
  ListThreadsQuerySchema,
  UpdateThreadStatusSchema,
} from "../schemas.ts";
import type { CommentRow, Env, ThreadRow, Variables } from "../types.ts";

export const threadsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>()
  .get("/", vValidator("query", ListThreadsQuerySchema), async (c) => {
    const { route, includeResolved } = c.req.valid("query");
    const where: string[] = [];
    const binds: unknown[] = [];
    if (route) {
      where.push("route = ?");
      binds.push(route);
    }
    if (includeResolved !== "true") {
      where.push("status = 'open'");
    }
    const sql = `SELECT * FROM threads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const { results } = await c.env.DB.prepare(sql)
      .bind(...binds)
      .all<ThreadRow>();
    return c.json({ threads: results });
  })
  .post("/", vValidator("json", CreateThreadSchema), async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const threadId = newThreadId().toString();
    const commentId = newCommentId().toString();
    const now = nowISO();

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO threads (
          id, route, url, component_path, component_line, component_index,
          commit_hash, dirty_build, x_ratio, y_ratio, viewport_w, viewport_h,
          status, created_by, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
      ).bind(
        threadId,
        body.route,
        body.url,
        body.component_path,
        body.component_line,
        body.component_index,
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
    ]);

    const [thread, comments] = await Promise.all([
      c.env.DB.prepare("SELECT * FROM threads WHERE id = ?").bind(threadId).first<ThreadRow>(),
      c.env.DB.prepare("SELECT * FROM comments WHERE thread_id = ? ORDER BY created_at ASC")
        .bind(threadId)
        .all<CommentRow>(),
    ]);
    return c.json({ thread, comments: comments.results }, 201);
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
      const thread = await c.env.DB.prepare("SELECT * FROM threads WHERE id = ?")
        .bind(id)
        .first<ThreadRow>();
      return c.json({ thread });
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
