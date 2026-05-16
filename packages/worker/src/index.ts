import { Hono } from "hono";
import { requireAuth } from "./auth.ts";
import { corsMiddleware } from "./cors.ts";
import { commentsRoutes } from "./routes/comments.ts";
import { threadsRoutes } from "./routes/threads.ts";
import type { Env, Variables } from "./types.ts";

const api = new Hono<{ Bindings: Env; Variables: Variables }>()
  .use("*", requireAuth())
  .get("/me", (c) => c.json(c.get("user")))
  .route("/threads", threadsRoutes)
  .route("/comments", commentsRoutes);

const app = new Hono<{ Bindings: Env; Variables: Variables }>()
  .use("*", corsMiddleware())
  .get("/health", (c) => c.json({ ok: true }))
  .route("/api", api)
  .notFound((c) => c.json({ error: "not_found" }, 404))
  .onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal_error" }, 500);
  });

export type AppType = typeof app;
export default app;
