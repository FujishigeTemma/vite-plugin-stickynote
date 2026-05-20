import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useStaleThreads, useThreadsList } from "../hooks/useThreadsList.ts";
import { serverMutations } from "../mutations.ts";
import { queryClient } from "../query-client.ts";
import { useStore } from "../store.ts";
import type { Thread } from "../types.ts";
import CommentForm from "./CommentForm.tsx";

export default function ThreadList(): React.ReactElement {
  const { visible } = useThreadsList();
  const { isStale } = useStaleThreads(visible);
  const openThreadId = useStore((s) => s.openThreadId);
  const openThread = useStore((s) => s.openThread);
  const options = useStore((s) => s.options);
  const createThread = useMutation(serverMutations.threads.create(), queryClient);

  const [showPageWideForm, setShowPageWideForm] = useState(false);

  const grouped = useMemo(
    () => ({
      pageWide: visible.filter((t) => t.components.length === 0),
      component: visible.filter((t) => t.components.length > 0),
    }),
    [visible],
  );

  const compLabel = (t: Thread): string => t.components[0]?.name ?? "page-wide";

  const createPageWide = async (body: string): Promise<void> => {
    if (!options) return;
    await createThread.mutateAsync({
      commit_hash: options.commitHash,
      dirty_build: options.dirtyBuild,
      x_ratio: 0,
      y_ratio: 0,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      components: [],
      body,
    });
    setShowPageWideForm(false);
  };

  return (
    <div>
      <h3 className="sn-section-title">For This Page</h3>
      {grouped.pageWide.length === 0 && !showPageWideForm ? (
        <div className="sn-empty">no page-wide threads on this route</div>
      ) : null}
      <div className="sn-thread-list">
        {grouped.pageWide.map((t) => (
          <div
            key={t.id}
            className={`sn-thread-card${openThreadId === t.id ? " sn-active-thread" : ""}`}
            onClick={() => openThread(t.id)}
          >
            <div className="sn-thread-meta">
              <span className="sn-comp">{compLabel(t)}</span>
              <span>· {t.created_by_name}</span>
              {t.status === "resolved" ? <span>· resolved</span> : null}
            </div>
            <div className="sn-thread-body">{t.first_comment_body}</div>
          </div>
        ))}
        {showPageWideForm ? (
          <div className="sn-thread-card">
            <CommentForm
              submitLabel="Post"
              cancelable
              onSubmit={createPageWide}
              onCancel={() => setShowPageWideForm(false)}
            />
          </div>
        ) : (
          <div className="sn-form-actions">
            <button type="button" onClick={() => setShowPageWideForm(true)}>
              + comment
            </button>
          </div>
        )}
      </div>

      <h3 className="sn-section-title">Per Component(s)</h3>
      {grouped.component.length === 0 ? (
        <div className="sn-empty">no component pins on this route</div>
      ) : null}
      <div className="sn-thread-list">
        {grouped.component.map((t) => {
          const classes = [
            "sn-thread-card",
            openThreadId === t.id ? "sn-active-thread" : "",
            isStale(t) ? "sn-thread-stale" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={t.id} className={classes} onClick={() => openThread(t.id)}>
              <div className="sn-thread-meta">
                <span className="sn-comp">{compLabel(t)}</span>
                <span>· {t.created_by_name}</span>
                {t.status === "resolved" ? <span>· resolved</span> : null}
                {isStale(t) ? <span className="sn-badge">stale</span> : null}
              </div>
              <div className="sn-thread-body">{t.first_comment_body}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
