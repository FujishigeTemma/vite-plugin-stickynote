import type { D1Database } from "@cloudflare/workers-types";

export type Env = {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  // Production Clerk credentials. Required in prod; ignored when the local-dev
  // escape hatch is active (CLERK_ISSUER === "dev").
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  // Local-dev escape hatch: set CLERK_ISSUER="dev" + DEV_BEARER (+ optional
  // DEV_USER_NAME) to bypass Clerk and accept a static bearer token.
  CLERK_ISSUER?: "dev";
  DEV_BEARER?: string;
  DEV_USER_NAME?: string;
};

export type AuthUser = {
  sub: string;
  name: string;
};

export type Variables = {
  user: AuthUser;
};

export type ThreadRow = {
  id: string;
  route: string;
  url: string;
  component_path: string | null;
  component_line: number | null;
  component_index: number;
  commit_hash: string;
  dirty_build: number;
  x_ratio: number;
  y_ratio: number;
  viewport_w: number;
  viewport_h: number;
  additional_components: string | null;
  status: "open" | "resolved";
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  // Non-null because deleting the head comment hard-deletes the thread, so a
  // live thread always has at least one comment.
  first_comment_body: string;
};

export type CommentRow = {
  id: string;
  thread_id: string;
  body: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
