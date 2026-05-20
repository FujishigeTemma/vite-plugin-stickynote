import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useThreadsList } from "../hooks/useThreadsList.ts";
import { buildGithubUrl, componentKey } from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";
import { useStore } from "../store.ts";
import CommentForm from "./CommentForm.tsx";
import CommentItem from "./CommentItem.tsx";

export default function ThreadDetail(): React.ReactElement | null {
  const { threads } = useThreadsList();
  const openThreadId = useStore((s) => s.openThreadId);
  const openThread = useStore((s) => s.openThread);
  const options = useStore((s) => s.options);

  const { data: comments } = useQuery(
    serverQueries.threads.comments.list(openThreadId),
    queryClient,
  );

  const reply = useMutation(serverMutations.comments.create(), queryClient);
  const setStatus = useMutation(serverMutations.threads.setStatus(), queryClient);

  const thread = useMemo(() => {
    if (!openThreadId) return null;
    return threads.find((t) => t.id === openThreadId) ?? null;
  }, [threads, openThreadId]);

  const primaryComponent = thread?.components[0] ?? null;

  const githubUrl = useMemo(() => {
    if (!thread || !options || !primaryComponent) return null;
    return buildGithubUrl(
      options.githubRepo,
      thread.commit_hash,
      primaryComponent.path,
      primaryComponent.line,
    );
  }, [thread, options, primaryComponent]);

  const viewportWarn = useMemo(() => {
    if (!thread || !primaryComponent) return false;
    const ratio = window.innerWidth / thread.viewport_w;
    return ratio < 0.7 || ratio > 1.4;
  }, [thread, primaryComponent]);

  const componentLabel = useMemo(() => {
    if (!primaryComponent) return "page-wide";
    return `${primaryComponent.name} · ${primaryComponent.path}:${primaryComponent.line}`;
  }, [primaryComponent]);

  const additionalLinks = useMemo(() => {
    if (!thread || thread.components.length <= 1) return [];
    const repo = options?.githubRepo ?? null;
    return thread.components.slice(1).map((c) => ({
      key: componentKey(c),
      label: `${c.name} · ${c.path}:${c.line}`,
      url: buildGithubUrl(repo, thread.commit_hash, c.path, c.line),
    }));
  }, [thread, options]);

  if (!thread) return null;

  const onReply = (body: string): void => {
    reply.mutate({ threadId: thread.id, body });
  };

  const toggleResolved = (): void => {
    const next = thread.status === "open" ? "resolved" : "open";
    setStatus.mutate({ threadId: thread.id, status: next });
  };

  return (
    <div className="sn-thread-detail">
      <button className="sn-detail-back" type="button" onClick={() => openThread(null)}>
        ← back to threads
      </button>
      <div className="sn-detail-meta">
        <span>{componentLabel}</span>
        {githubUrl ? (
          <a href={githubUrl} target="_blank" rel="noopener">
            github
          </a>
        ) : null}
        {thread.dirty_build ? <span className="sn-badge">local changes</span> : null}
        {viewportWarn ? <span className="sn-badge">viewport differs</span> : null}
      </div>
      {additionalLinks.length > 0 ? (
        <ul className="sn-detail-linked">
          {additionalLinks.map((link) => (
            <li key={link.key}>
              <span>{link.label}</span>
              {link.url ? (
                <a href={link.url} target="_blank" rel="noopener">
                  github
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="sn-comments">
        {(comments ?? []).map((c) => (
          <CommentItem key={c.id} comment={c} />
        ))}
      </div>
      <CommentForm submitLabel="Reply" onSubmit={onReply} />
      <div className="sn-form-actions">
        <button type="button" onClick={toggleResolved}>
          {thread.status === "open" ? "Resolve" : "Reopen"}
        </button>
      </div>
    </div>
  );
}
