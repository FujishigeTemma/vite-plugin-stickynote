export type Env = {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  // Either a real Clerk Frontend API origin, or the literal "dev" sentinel
  // to enable the local-only static-bearer auth path.
  CLERK_ISSUER: string;
  // Required when CLERK_ISSUER === "dev". Ignored otherwise.
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
  status: "open" | "resolved";
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
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
