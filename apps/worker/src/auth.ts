import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { AuthUser, Env, Variables } from "./types.ts";

type JWKSCache = {
  issuer: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
};

let cache: JWKSCache | undefined;

function getJWKS(issuer: string) {
  if (!cache || cache.issuer !== issuer) {
    const url = new URL(".well-known/jwks.json", normalizeIssuer(issuer));
    cache = { issuer, jwks: createRemoteJWKSet(url) };
  }
  return cache.jwks;
}

function normalizeIssuer(issuer: string): string {
  return issuer.endsWith("/") ? issuer : `${issuer}/`;
}

export const requireAuth = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      return c.json({ error: "missing_token" }, 401);
    }
    const issuer = c.env.CLERK_ISSUER;
    if (!issuer) {
      return c.json({ error: "issuer_not_configured" }, 500);
    }

    // Local-dev only: structurally gated by the "dev" sentinel issuer.
    // Production Clerk issuers are always full https URLs, so this branch
    // cannot be reached when CLERK_ISSUER points at a real Clerk instance.
    if (issuer === "dev") {
      const expected = c.env.DEV_BEARER;
      if (!expected) {
        return c.json({ error: "dev_bearer_not_configured" }, 500);
      }
      if (token !== expected) {
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

    try {
      const { payload } = await jwtVerify(token, getJWKS(issuer), {
        issuer,
      });
      const sub = typeof payload.sub === "string" ? payload.sub : undefined;
      if (!sub) {
        return c.json({ error: "invalid_subject" }, 401);
      }
      const name = pickName(payload) ?? sub;
      const user: AuthUser = { sub, name };
      c.set("user", user);
      await next();
      return;
    } catch {
      return c.json({ error: "invalid_token" }, 401);
    }
  };
};

function pickName(payload: Record<string, unknown>): string | undefined {
  for (const key of ["name", "full_name", "fullName", "username"]) {
    const v = payload[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}
