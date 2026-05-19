import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

import { useAnchorBinding } from "../anchor-binding.ts";
import { clamp } from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { serverQueries } from "../queries/server.ts";
import { queryClient } from "../query-client.ts";
import { useStore } from "../store.ts";
import type { Thread } from "../types.ts";

type Props = { thread: Thread };

const DRAG_THRESHOLD = 4;

export default function Pin(props: Props): React.ReactElement | null {
  const openThreadId = useStore((s) => s.openThreadId);
  const openThread = useStore((s) => s.openThread);

  const updatePosition = useMutation(serverMutations.threads.updatePosition(), queryClient);
  const { data: comments } = useQuery(
    {
      ...serverQueries.threads.comments.list(props.thread.id),
      enabled: openThreadId === props.thread.id,
    },
    queryClient,
  );

  const canDrag = props.thread.components.length > 0;
  const anchorName = `--sn-pin-${props.thread.id}`;
  const { element: anchor } = useAnchorBinding(props.thread.components[0] ?? null, anchorName);

  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = dragPos !== null;
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const anchorRectAtStartRef = useRef<DOMRect | null>(null);

  const stale = canDrag && anchor == null;
  const isOpen = openThreadId === props.thread.id;
  const label = comments?.length ?? 1;

  // The CSS rule `.sn-pin-anchored:not(.sn-pin-dragging)` reads `--x` /
  // `--y` and resolves position via `anchor()`. While dragging we hand
  // the pin explicit pixel coords from the pointer; the
  // `:not(.sn-pin-dragging)` guard lets those win without `!important`.
  const pinStyle = useMemo<React.CSSProperties>(() => {
    if (dragPos) {
      return { left: `${dragPos.x}px`, top: `${dragPos.y}px` };
    }
    if (canDrag && anchor) {
      return {
        positionAnchor: anchorName,
        ["--x" as string]: String(props.thread.x_ratio),
        ["--y" as string]: String(props.thread.y_ratio),
      } as React.CSSProperties;
    }
    return {};
  }, [dragPos, canDrag, anchor, anchorName, props.thread.x_ratio, props.thread.y_ratio]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.button !== 0) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    if (canDrag) {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (!dragStartRef.current) return;
    if (!dragging) {
      if (!canDrag) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!anchor) return;
      anchorRectAtStartRef.current = anchor.getBoundingClientRect();
      e.preventDefault();
    }
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const resetDrag = (): void => {
    setDragPos(null);
    dragStartRef.current = null;
    anchorRectAtStartRef.current = null;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const wasDragging = dragging;
    const target = e.currentTarget as Element;
    if (target.hasPointerCapture?.(e.pointerId)) {
      target.releasePointerCapture?.(e.pointerId);
    }
    if (!wasDragging) {
      resetDrag();
      openThread(props.thread.id);
      return;
    }
    const r = anchorRectAtStartRef.current;
    const pos = dragPos;
    if (r && pos && r.width > 0 && r.height > 0) {
      const xr = clamp((pos.x - r.left) / r.width);
      const yr = clamp((pos.y - r.top) / r.height);
      updatePosition.mutate({ threadId: props.thread.id, x_ratio: xr, y_ratio: yr });
    }
    resetDrag();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const target = e.currentTarget as Element;
    if (target.hasPointerCapture?.(e.pointerId)) {
      target.releasePointerCapture?.(e.pointerId);
    }
    resetDrag();
  };

  if (stale) return null;
  const classes = [
    "sn-pin",
    props.thread.status === "resolved" ? "sn-pin-resolved" : "",
    isOpen ? "sn-pin-open" : "",
    canDrag ? "sn-pin-draggable" : "",
    dragging ? "sn-pin-dragging" : "",
    canDrag && anchor && !dragging ? "sn-pin-anchored" : "",
    !canDrag ? "sn-pin-pagewide" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      style={pinStyle}
      title={`${props.thread.created_by_name}: ${label} comment(s)`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {label}
    </button>
  );
}
