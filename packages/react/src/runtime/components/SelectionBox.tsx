import { useAnchorBinding } from "../anchor-binding.ts";
import type { Component } from "../types.ts";

// One selection rectangle, anchored to a single component occurrence.
// Lives as a separate component so `useAnchorBinding` can be called once
// per list item — React hooks (like Vue composables) can't be invoked
// inside loops of a parent body.
type Props = {
  component: Pick<Component, "path" | "line" | "v_for_index">;
  anchorName: string;
  label: string;
};

export default function SelectionBox(props: Props): React.ReactElement | null {
  const { element } = useAnchorBinding(props.component, props.anchorName);

  if (!element) return null;
  return (
    <>
      <div
        className="sn-sel"
        data-stickynote-ignore=""
        style={{ positionAnchor: props.anchorName } as React.CSSProperties}
      />
      <div
        className="sn-sel-label"
        data-stickynote-ignore=""
        style={{ positionAnchor: props.anchorName } as React.CSSProperties}
      >
        {props.label}
      </div>
    </>
  );
}
