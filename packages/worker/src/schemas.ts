import * as v from "valibot";

const NonEmptyString = v.pipe(v.string(), v.trim(), v.minLength(1));

export const ThreadIdParamSchema = v.object({
  threadId: NonEmptyString,
});

export const ThreadCommentParamsSchema = v.object({
  threadId: NonEmptyString,
  commentId: NonEmptyString,
});

export const ComponentInputSchema = v.object({
  path: v.string(),
  line: v.number(),
  v_for_index: v.number(),
  name: v.string(),
});

export const CreateThreadSchema = v.object({
  route: v.string(),
  url: v.string(),
  commit_hash: v.string(),
  dirty_build: v.boolean(),
  x_ratio: v.number(),
  y_ratio: v.number(),
  viewport_w: v.number(),
  viewport_h: v.number(),
  components: v.array(ComponentInputSchema),
  body: NonEmptyString,
});

export const UpdateThreadStatusSchema = v.object({
  status: v.picklist(["open", "resolved"]),
});

export const UpdateThreadPositionSchema = v.object({
  x_ratio: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  y_ratio: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
});

export const ListThreadsQuerySchema = v.object({
  route: v.optional(v.string()),
  includeResolved: v.optional(v.picklist(["true", "false"])),
  q: v.optional(v.pipe(v.string(), v.maxLength(200))),
});

export const CreateReplySchema = v.object({
  body: NonEmptyString,
});

export const EditCommentSchema = v.object({
  body: NonEmptyString,
});
