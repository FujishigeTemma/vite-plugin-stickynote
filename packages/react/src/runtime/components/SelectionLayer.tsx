import { useMemo } from "react";

import { useThreadsList } from "../hooks/useThreadsList.ts";
import { componentAnchorName, componentKey } from "../inspector.ts";
import { useStore } from "../store.ts";
import type { Component } from "../types.ts";
import SelectionBox from "./SelectionBox.tsx";

// Renders selection boxes for whichever source is "active":
//   - the composer's in-progress component picks (passed via prop)
//   - else the currently-open thread's components
// Composer takes priority — Inspector.tsx passes its picks in; we fall
// back to the open thread otherwise.
type Props = {
  composerPicks: Pick<Component, "path" | "line" | "v_for_index" | "name">[];
};

export default function SelectionLayer(props: Props): React.ReactElement {
  const { threads } = useThreadsList();
  const openThreadId = useStore((s) => s.openThreadId);

  const items = useMemo<Pick<Component, "path" | "line" | "v_for_index" | "name">[]>(() => {
    if (props.composerPicks.length > 0) return props.composerPicks;
    if (!openThreadId) return [];
    const thread = threads.find((t) => t.id === openThreadId);
    return thread?.components ?? [];
  }, [props.composerPicks, threads, openThreadId]);

  return (
    <>
      {items.map((item, i) => (
        <SelectionBox
          key={componentKey(item)}
          component={item}
          anchorName={componentAnchorName(item)}
          label={`${i === 0 ? "★ " : ""}${item.name}`}
        />
      ))}
    </>
  );
}
