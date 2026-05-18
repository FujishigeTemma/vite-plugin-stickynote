import type { D1Database } from "@cloudflare/workers-types";

export type Env = {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  // Production Clerk credentials. Required in prod; ignored when the local-dev
  // escape hatch is active (DEV_BEARER is set).
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  // Local-dev escape hatch: set DEV_BEARER (+ optional DEV_USER_NAME) to
  // bypass Clerk and accept a static bearer token.
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
  commit_hash: string;
  dirty_build: number;
  x_ratio: number;
  y_ratio: number;
  viewport_w: number;
  viewport_h: number;
  status: "open" | "resolved";
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  // Non-null because deleting the head comment hard-deletes the thread, so a
  // live thread always has at least one comment.
  first_comment_body: string;
};

export type ComponentRow = {
  id: string;
  thread_id: string;
  display_order: number;
  path: string;
  line: number;
  v_for_index: number;
  name: string;
};

// Wire shape exposed by routes; thread_id is implicit from the parent thread.
export type Component = Omit<ComponentRow, "thread_id">;

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
