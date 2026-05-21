import { createClerkClient } from "@clerk/backend";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { Context, MiddlewareHandler, Next } from "hono";
import { nowISO } from "./id.ts";
import { PAT_PREFIX, sha256Hex } from "./tokens.ts";
import type { AgentTokenRow, AuthUser, Env, UserCacheRow, Variables } from "./types.ts";

const USER_NAME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

export const requireAuth = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const bearer = extractBearer(c.req.header("Authorization"));

    // Local-dev escape hatch — production deploys never set DEV_BEARER.
    if (c.env.DEV_BEARER) return authenticateDev(c, bearer, next);

    if (bearer?.startsWith(PAT_PREFIX)) return authenticatePat(c, bearer, next);

    return authenticateClerk(c, next);
  };
};

export function extractBearer(header: string | undefined): string | undefined {
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

async function authenticateDev(c: Ctx, bearer: string | undefined, next: Next) {
  if (!bearer || bearer !== c.env.DEV_BEARER) {
    return c.json({ error: "invalid_token" }, 401);
  }
  const user: AuthUser = {
    sub: "dev_user",
    name: c.env.DEV_USER_NAME ?? "Dev User",
  };
  c.set("user", user);
  await next();
}

async function authenticatePat(c: Ctx, bearer: string, next: Next) {
  const hash = await sha256Hex(bearer);
  const row = await c.env.DB.prepare(
    "SELECT owner_sub, owner_name, token_hash, created_at, last_used_at FROM agent_tokens WHERE token_hash = ?",
  )
    .bind(hash)
    .first<AgentTokenRow>();
  if (!row) return c.json({ error: "invalid_token" }, 401);

  const touch = c.env.DB.prepare("UPDATE agent_tokens SET last_used_at = ? WHERE owner_sub = ?")
    .bind(nowISO(), row.owner_sub)
    .run();
  c.executionCtx.waitUntil(touch);

  c.set("user", { sub: row.owner_sub, name: `${row.owner_name} (AI)` });
  await next();
}

async function authenticateClerk(c: Ctx, next: Next) {
  const clerkResp = await clerkMiddleware({
    secretKey: c.env.CLERK_SECRET_KEY,
    publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
  })(c, async () => {});
  if (clerkResp) return clerkResp;

  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: "unauthorized" }, 401);

  const name = await resolveUserName(c, auth.userId);
  c.set("user", { sub: auth.userId, name });
  await next();
}

async function resolveUserName(c: Ctx, sub: string): Promise<string> {
  const cached = await c.env.DB.prepare("SELECT sub, full_name, cached_at FROM users WHERE sub = ?")
    .bind(sub)
    .first<UserCacheRow>();

  if (cached && Date.now() - Date.parse(cached.cached_at) < USER_NAME_CACHE_TTL_MS) {
    return cached.full_name;
  }

  const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  const clerkUser = await clerk.users.getUser(sub);
  const fullName = clerkUser.fullName ?? sub;

  const upsert = c.env.DB.prepare(
    "INSERT INTO users (sub, full_name, cached_at) VALUES (?, ?, ?) ON CONFLICT(sub) DO UPDATE SET full_name = excluded.full_name, cached_at = excluded.cached_at",
  )
    .bind(sub, fullName, nowISO())
    .run();
  c.executionCtx.waitUntil(upsert);

  return fullName;
}
