import type { MiddlewareHandler } from "hono";
import type { Env, Variables } from "./types.ts";

export const corsMiddleware = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const allowed = (c.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = c.req.header("Origin");
    const isAllowed = !!origin && allowed.includes(origin);

    if (c.req.method === "OPTIONS") {
      if (!isAllowed) return c.body(null, 403);
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    await next();
    if (isAllowed && origin) {
      for (const [k, v] of Object.entries(corsHeaders(origin))) {
        c.res.headers.set(k, v);
      }
    }
  };
};

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
