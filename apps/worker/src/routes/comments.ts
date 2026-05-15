import { Hono } from "hono";
import { newId, nowIso } from "../id.ts";
import type { CommentRow, Env, Variables } from "../types.ts";

export const commentsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

type CreateReplyBody = { thread_id: string; body: string };
type EditCommentBody = { body: string };

commentsRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<CreateReplyBody>();
  if (!body.thread_id || !body.body?.trim()) {
    return c.json({ error: "invalid_body" }, 400);
  }
  const exists = await c.env.DB.prepare("SELECT id FROM threads WHERE id = ?")
    .bind(body.thread_id)
    .first<{ id: string }>();
  if (!exists) return c.json({ error: "thread_not_found" }, 404);

  const id = newId("co");
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO comments (id, thread_id, body, created_by, created_by_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, body.thread_id, body.body, user.sub, user.name, now, now)
    .run();

  const comment = await c.env.DB.prepare("SELECT * FROM comments WHERE id = ?")
    .bind(id)
    .first<CommentRow>();
  return c.json({ comment }, 201);
});

commentsRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<EditCommentBody>();
  if (!body.body?.trim()) return c.json({ error: "body_required" }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT created_by, deleted_at FROM comments WHERE id = ?",
  )
    .bind(id)
    .first<{ created_by: string; deleted_at: string | null }>();
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (existing.created_by !== user.sub) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (existing.deleted_at) return c.json({ error: "deleted" }, 410);

  const now = nowIso();
  await c.env.DB.prepare("UPDATE comments SET body = ?, updated_at = ? WHERE id = ?")
    .bind(body.body, now, id)
    .run();
  const comment = await c.env.DB.prepare("SELECT * FROM comments WHERE id = ?")
    .bind(id)
    .first<CommentRow>();
  return c.json({ comment });
});

// Soft delete a reply, OR hard-delete the whole thread if this is the head comment.
commentsRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const target = await c.env.DB.prepare(
    "SELECT id, thread_id, created_by FROM comments WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string; thread_id: string; created_by: string }>();
  if (!target) return c.json({ error: "not_found" }, 404);
  if (target.created_by !== user.sub) {
    return c.json({ error: "forbidden" }, 403);
  }

  const head = await c.env.DB.prepare(
    "SELECT id FROM comments WHERE thread_id = ? ORDER BY created_at ASC LIMIT 1",
  )
    .bind(target.thread_id)
    .first<{ id: string }>();

  if (head?.id === target.id) {
    await c.env.DB.prepare("DELETE FROM threads WHERE id = ?").bind(target.thread_id).run();
    return c.json({ ok: true, thread_deleted: true });
  }

  await c.env.DB.prepare("UPDATE comments SET deleted_at = ? WHERE id = ?")
    .bind(nowIso(), id)
    .run();
  const comment = await c.env.DB.prepare("SELECT * FROM comments WHERE id = ?")
    .bind(id)
    .first<CommentRow>();
  return c.json({ comment });
});
