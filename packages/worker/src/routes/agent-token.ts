import { Hono } from "hono";
import { extractBearer } from "../auth.ts";
import { nowISO } from "../id.ts";
import { generateToken, PAT_PREFIX } from "../tokens.ts";
import type { AgentTokenRow, Env, Variables } from "../types.ts";

export const agentTokenRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>()
  // PATs cannot manage PATs — only the Clerk-authed owner can mint or revoke.
  .use("*", async (c, next) => {
    const bearer = extractBearer(c.req.header("Authorization"));
    if (bearer?.startsWith(PAT_PREFIX)) {
      return c.json({ error: "pat_cannot_manage_token" }, 403);
    }
    await next();
  })
  .get("/", async (c) => {
    const user = c.get("user");
    const row = await c.env.DB.prepare(
      "SELECT created_at, last_used_at FROM agent_tokens WHERE owner_sub = ?",
    )
      .bind(user.sub)
      .first<Pick<AgentTokenRow, "created_at" | "last_used_at">>();
    if (!row) return c.json({ exists: false });
    return c.json({
      exists: true,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
    });
  })
  .post("/", async (c) => {
    const user = c.get("user");
    const { plaintext, hash } = await generateToken();
    const now = nowISO();
    await c.env.DB.prepare(
      `INSERT INTO agent_tokens (owner_sub, owner_name, token_hash, created_at, last_used_at)
       VALUES (?, ?, ?, ?, NULL)
       ON CONFLICT(owner_sub) DO UPDATE SET
         owner_name = excluded.owner_name,
         token_hash = excluded.token_hash,
         created_at = excluded.created_at,
         last_used_at = NULL`,
    )
      .bind(user.sub, user.name, hash, now)
      .run();
    return c.json({ token: plaintext, created_at: now }, 201);
  })
  .delete("/", async (c) => {
    const user = c.get("user");
    await c.env.DB.prepare("DELETE FROM agent_tokens WHERE owner_sub = ?").bind(user.sub).run();
    return c.body(null, 204);
  });
