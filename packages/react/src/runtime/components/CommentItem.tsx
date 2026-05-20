import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { serverMutations } from "../mutations.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";
import type { Comment } from "../types.ts";
import CommentForm from "./CommentForm.tsx";

type Props = { comment: Comment };

export default function CommentItem(props: Props): React.ReactElement {
  const { data: me } = useQuery(serverQueries.me(), queryClient);
  const editComment = useMutation(serverMutations.comments.edit(), queryClient);
  const deleteComment = useMutation(serverMutations.comments.delete(), queryClient);

  const [editing, setEditing] = useState(false);

  // `me.sub` is the JWT-verified subject — same identity regardless of
  // auth path (Clerk JWT or dev-bearer fallback).
  const ownedByCurrent = me?.sub === props.comment.created_by;

  const onEdit = (body: string): void => {
    editComment.mutate(
      { threadId: props.comment.thread_id, commentId: props.comment.id, body },
      { onSuccess: () => setEditing(false) },
    );
  };

  const onDelete = (): void => {
    if (!confirm("Delete this comment?")) return;
    deleteComment.mutate({ threadId: props.comment.thread_id, commentId: props.comment.id });
  };

  return (
    <div className={`sn-comment${props.comment.deleted_at ? " sn-deleted" : ""}`}>
      <div className="sn-comment-head">
        <span className="sn-comment-author">{props.comment.created_by_name}</span>
        {ownedByCurrent && !props.comment.deleted_at ? (
          <span className="sn-comment-actions">
            <button type="button" onClick={() => setEditing((v) => !v)}>
              {editing ? "cancel" : "edit"}
            </button>
            <button type="button" onClick={onDelete}>
              delete
            </button>
          </span>
        ) : null}
      </div>
      {props.comment.deleted_at ? (
        <div className="sn-comment-body">[deleted comment]</div>
      ) : !editing ? (
        <div className="sn-comment-body">{props.comment.body}</div>
      ) : (
        <CommentForm
          initialBody={props.comment.body}
          submitLabel="Save"
          cancelable
          onSubmit={onEdit}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}
