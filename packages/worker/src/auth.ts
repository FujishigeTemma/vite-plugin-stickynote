import { createClerkClient } from "@clerk/backend";
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

    const allowedDomains = parseDomainAllowlist(c.env.ALLOWED_EMAIL_DOMAINS);
    if (allowedDomains.length > 0) {
      const allowed = await isUserDomainAllowed(
        auth.userId,
        allowedDomains,
        c.env.CLERK_SECRET_KEY,
        c.env.CLERK_PUBLISHABLE_KEY,
      );
      if (!allowed) return c.json({ error: "forbidden_domain" }, 403);
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

function parseDomainAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Per-isolate cache keyed by Clerk userId (sub). Avoids hitting Clerk's
// users.getUser endpoint on every authenticated request. Cloudflare reuses
// isolates across requests, so this Map persists between invocations within
// the same isolate; a different colo / cold start re-fetches once.
// Both positive and negative results are cached — a blocked user shouldn't
// be able to amplify their requests into Clerk API traffic.
type DomainCacheEntry = { allowed: boolean; expiresAt: number };
const domainCheckCache = new Map<string, DomainCacheEntry>();
const DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000;

async function isUserDomainAllowed(
  userId: string,
  allowedDomains: string[],
  secretKey: string,
  publishableKey: string,
): Promise<boolean> {
  const now = Date.now();
  const cached = domainCheckCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.allowed;

  const clerkClient = createClerkClient({ secretKey, publishableKey });
  const userObj = await clerkClient.users.getUser(userId);
  // Allow if ANY linked email's domain is on the allowlist — users routinely
  // attach a personal address as secondary, and the check is meant to gate on
  // organizational membership, not which address they happened to mark primary.
  const allowed = userObj.emailAddresses.some((e) => {
    const domain = e.emailAddress?.toLowerCase().split("@")[1];
    return !!domain && allowedDomains.includes(domain);
  });

  domainCheckCache.set(userId, { allowed, expiresAt: now + DOMAIN_CACHE_TTL_MS });
  return allowed;
}

function pickName(payload: Record<string, unknown>): string | undefined {
  for (const key of ["name", "full_name", "fullName", "username"]) {
    const v = payload[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}
