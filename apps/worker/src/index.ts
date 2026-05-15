import { Hono } from "hono";
import { requireAuth } from "./auth.ts";
import { corsMiddleware } from "./cors.ts";
import { threadsRoutes } from "./routes/threads.ts";
import { commentsRoutes } from "./routes/comments.ts";
import type { Env, Variables } from "./types.ts";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", corsMiddleware());

app.get("/health", (c) => c.json({ ok: true }));

const api = new Hono<{ Bindings: Env; Variables: Variables }>();
api.use("*", requireAuth());
api.get("/me", (c) => c.json(c.get("user")));
api.route("/threads", threadsRoutes);
api.route("/comments", commentsRoutes);

app.route("/api", api);

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
