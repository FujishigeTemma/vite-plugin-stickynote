import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import { newCommentId, nowISO } from "../id.ts";
import {
  CreateReplySchema,
  EditCommentSchema,
  ThreadCommentParamsSchema,
  ThreadIdParamSchema,
} from "../schemas.ts";
import type { CommentRow, Env, Variables } from "../types.ts";

// Nested under `/api/threads/:threadId/comments`. Every handler reads the
// thread id from the merged param validator alongside its own `:commentId`.
export const commentsRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>()
  .get("/", vValidator("param", ThreadIdParamSchema), async (c) => {
    const { threadId } = c.req.valid("param");
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM comments WHERE thread_id = ? ORDER BY created_at ASC",
    )
      .bind(threadId)
      .all<CommentRow>();
    return c.json({ comments: results });
  })
  .post(
    "/",
    vValidator("param", ThreadIdParamSchema),
    vValidator("json", CreateReplySchema),
    async (c) => {
      const user = c.get("user");
      const { threadId } = c.req.valid("param");
      const body = c.req.valid("json");
      const exists = await c.env.DB.prepare("SELECT id FROM threads WHERE id = ?")
        .bind(threadId)
        .first<{ id: string }>();
      if (!exists) return c.json({ error: "thread_not_found" }, 404);

      const id = newCommentId().toString();
      const now = nowISO();
      await c.env.DB.prepare(
        `INSERT INTO comments (id, thread_id, body, created_by, created_by_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, threadId, body.body, user.sub, user.name, now, now)
        .run();

      const comment = await c.env.DB.prepare("SELECT * FROM comments WHERE id = ?")
        .bind(id)
        .first<CommentRow>();
      return c.json({ comment }, 201);
    },
  )
  .patch(
    "/:commentId",
    vValidator("param", ThreadCommentParamsSchema),
    vValidator("json", EditCommentSchema),
    async (c) => {
      const user = c.get("user");
      const { threadId, commentId } = c.req.valid("param");
      const body = c.req.valid("json");

      const existing = await c.env.DB.prepare(
        "SELECT thread_id, created_by, deleted_at FROM comments WHERE id = ?",
      )
        .bind(commentId)
        .first<{ thread_id: string; created_by: string; deleted_at: string | null }>();
      if (!existing) return c.json({ error: "not_found" }, 404);
      if (existing.thread_id !== threadId) return c.json({ error: "not_found" }, 404);
      if (existing.created_by !== user.sub) {
        return c.json({ error: "forbidden" }, 403);
      }
      if (existing.deleted_at) return c.json({ error: "deleted" }, 410);

      const now = nowISO();
      await c.env.DB.prepare("UPDATE comments SET body = ?, updated_at = ? WHERE id = ?")
        .bind(body.body, now, commentId)
        .run();
      const comment = await c.env.DB.prepare("SELECT * FROM comments WHERE id = ?")
        .bind(commentId)
        .first<CommentRow>();
      return c.json({ comment });
    },
  )
  // Soft delete a reply, OR hard-delete the whole thread if this is the head comment.
  .delete("/:commentId", vValidator("param", ThreadCommentParamsSchema), async (c) => {
    const user = c.get("user");
    const { threadId, commentId } = c.req.valid("param");

    const target = await c.env.DB.prepare(
      "SELECT id, thread_id, created_by FROM comments WHERE id = ?",
    )
      .bind(commentId)
      .first<{ id: string; thread_id: string; created_by: string }>();
    if (!target) return c.json({ error: "not_found" }, 404);
    if (target.thread_id !== threadId) return c.json({ error: "not_found" }, 404);
    if (target.created_by !== user.sub) {
      return c.json({ error: "forbidden" }, 403);
    }
    const head = await c.env.DB.prepare(
      "SELECT id FROM comments WHERE thread_id = ? ORDER BY created_at ASC LIMIT 1",
    )
      .bind(threadId)
      .first<{ id: string }>();

    if (head?.id === target.id) {
      await c.env.DB.prepare("DELETE FROM threads WHERE id = ?").bind(threadId).run();
      return c.json({ ok: true, thread_deleted: true });
    }

    await c.env.DB.prepare("UPDATE comments SET deleted_at = ? WHERE id = ?")
      .bind(nowISO(), commentId)
      .run();
    const comment = await c.env.DB.prepare("SELECT * FROM comments WHERE id = ?")
      .bind(commentId)
      .first<CommentRow>();
    return c.json({ comment });
  });
