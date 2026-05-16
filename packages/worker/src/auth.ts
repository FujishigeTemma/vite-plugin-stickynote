import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { MiddlewareHandler } from "hono";
import type { AuthUser, Env, Variables } from "./types.ts";

export const requireAuth = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    // Local-dev escape hatch: static bearer gated by the "dev" sentinel.
    // Production deploys never set CLERK_ISSUER, so this branch is unreachable
    // when CLERK_SECRET_KEY is configured.
    if (c.env.CLERK_ISSUER === "dev") {
      const expected = c.env.DEV_BEARER;
      if (!expected) {
        return c.json({ error: "dev_bearer_not_configured" }, 500);
      }
      const header = c.req.header("Authorization");
      const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
      if (!token || token !== expected) {
        return c.json({ error: "invalid_token" }, 401);
      }
      const user: AuthUser = {
        sub: "dev_user",
        name: c.env.DEV_USER_NAME ?? "Dev User",
      };
      c.set("user", user);
      await next();
      return;
    }

    // Let Clerk authenticate first (passing a no-op next so it only populates
    // c.var.clerkAuth without proceeding). If Clerk needs to short-circuit
    // (e.g., handshake redirect) it returns a Response which we surface.
    const clerkResp = await clerkMiddleware({
      secretKey: c.env.CLERK_SECRET_KEY,
      publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
    })(c, async () => {});
    if (clerkResp) return clerkResp;

    const auth = getAuth(c);
    if (!auth?.userId) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const claims = (auth.sessionClaims ?? {}) as Record<string, unknown>;
    const user: AuthUser = {
      sub: auth.userId,
      name: pickName(claims) ?? auth.userId,
    };
    c.set("user", user);
    await next();
  };
};

function pickName(payload: Record<string, unknown>): string | undefined {
  for (const key of ["name", "full_name", "fullName", "username"]) {
    const v = payload[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}
