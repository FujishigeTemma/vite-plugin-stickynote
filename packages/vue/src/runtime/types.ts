// API contract mirrored from apps/worker/src/types.ts. Kept inline per
// the workspace convention until duplication actually hurts (YAGNI on a
// shared package).

export type Thread = {
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

export type Comment = {
  id: string;
  thread_id: string;
  body: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreateThreadInput = {
  route: string;
  url: string;
  component_path: string | null;
  component_line: number | null;
  component_index: number;
  commit_hash: string;
  dirty_build: boolean;
  x_ratio: number;
  y_ratio: number;
  viewport_w: number;
  viewport_h: number;
  body: string;
};
