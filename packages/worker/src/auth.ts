import { createClerkClient } from "@clerk/backend";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { MiddlewareHandler } from "hono";
import type { AuthUser, Env, Variables } from "./types.ts";

export const requireAuth = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    // Local-dev escape hatch: when DEV_BEARER is set in the worker env, accept
    // a static bearer in place of a Clerk JWT. Production deploys never set
    // DEV_BEARER, so this branch is unreachable there.
    const expected = c.env.DEV_BEARER;
    if (expected) {
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
    // Default Clerk session JWTs carry no user profile, so reach for the
    // `User.fullName` resource directly. One REST round-trip per authed
    // request — fine for an annotation tool; revisit with a KV cache if the
    // 5s thread-list poll becomes hot.
    const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
    const clerkUser = await clerk.users.getUser(auth.userId);
    const user: AuthUser = {
      sub: auth.userId,
      name: clerkUser.fullName ?? auth.userId,
    };
    c.set("user", user);
    await next();
  };
};
