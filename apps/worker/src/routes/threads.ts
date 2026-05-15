import { Hono } from "hono";
import { newId, nowIso } from "../id.ts";
import type { CommentRow, Env, ThreadRow, Variables } from "../types.ts";

export const threadsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

type CreateThreadBody = {
  route: string;
  url: string;
  component_path: string | null;
  component_line: number | null;
  component_index?: number;
  commit_hash: string;
  dirty_build: boolean;
  x_ratio: number;
  y_ratio: number;
  viewport_w: number;
  viewport_h: number;
  body: string;
};

type UpdateThreadStatusBody = {
  status: "open" | "resolved";
};

threadsRoutes.get("/", async (c) => {
  const route = c.req.query("route");
  const includeResolved = c.req.query("includeResolved") === "true";

  const where: string[] = [];
  const binds: unknown[] = [];
  if (route) {
    where.push("route = ?");
    binds.push(route);
  }
  if (!includeResolved) {
    where.push("status = 'open'");
  }
  const sql = `SELECT * FROM threads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all<ThreadRow>();
  return c.json({ threads: results });
});

threadsRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<CreateThreadBody>();
  if (!body.body?.trim()) {
    return c.json({ error: "body_required" }, 400);
  }
  const threadId = newId("th");
  const commentId = newId("co");
  const now = nowIso();

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
      body.component_index ?? 0,
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
});

threadsRoutes.patch("/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<UpdateThreadStatusBody>();
  if (body.status !== "open" && body.status !== "resolved") {
    return c.json({ error: "invalid_status" }, 400);
  }
  const result = await c.env.DB.prepare(
    "UPDATE threads SET status = ?, updated_at = ? WHERE id = ?",
  )
    .bind(body.status, nowIso(), id)
    .run();
  if (!result.meta.changes) return c.json({ error: "not_found" }, 404);
  const thread = await c.env.DB.prepare("SELECT * FROM threads WHERE id = ?")
    .bind(id)
    .first<ThreadRow>();
  return c.json({ thread });
});

threadsRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const thread = await c.env.DB.prepare("SELECT created_by FROM threads WHERE id = ?")
    .bind(id)
    .first<{ created_by: string }>();
  if (!thread) return c.json({ error: "not_found" }, 404);
  if (thread.created_by !== user.sub) {
    return c.json({ error: "forbidden" }, 403);
  }
  await c.env.DB.prepare("DELETE FROM threads WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

threadsRoutes.get("/:id/comments", async (c) => {
  const id = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM comments WHERE thread_id = ? ORDER BY created_at ASC",
  )
    .bind(id)
    .all<CommentRow>();
  return c.json({ comments: results });
});
