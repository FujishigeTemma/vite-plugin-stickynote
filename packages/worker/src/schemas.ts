import * as v from "valibot";

const NonEmptyString = v.pipe(v.string(), v.trim(), v.minLength(1));

export const CreateThreadSchema = v.object({
  route: v.string(),
  url: v.string(),
  component_path: v.nullable(v.string()),
  component_line: v.nullable(v.number()),
  component_index: v.optional(v.number(), 0),
  commit_hash: v.string(),
  dirty_build: v.boolean(),
  x_ratio: v.number(),
  y_ratio: v.number(),
  viewport_w: v.number(),
  viewport_h: v.number(),
  body: NonEmptyString,
});

export const UpdateThreadStatusSchema = v.object({
  status: v.picklist(["open", "resolved"]),
});

export const ListThreadsQuerySchema = v.object({
  route: v.optional(v.string()),
  includeResolved: v.optional(v.picklist(["true", "false"])),
});

export const CreateReplySchema = v.object({
  thread_id: NonEmptyString,
  body: NonEmptyString,
});

export const EditCommentSchema = v.object({
  body: NonEmptyString,
});

export const IdParamSchema = v.object({
  id: NonEmptyString,
});
