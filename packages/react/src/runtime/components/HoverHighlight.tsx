// Pure CSS-anchored hover rectangle. The active highlight target is
// communicated by stamping `anchor-name: --sn-hover` onto the element being
// hovered (Inspector.tsx owns that toggle); the browser then resizes /
// repositions this box for free via `anchor()` / `anchor-size()`.
//
// Two label modes share the rect:
// - "info" (default): component name + source path
// - "jump" (Cmd/Ctrl held): preview of the GitHub destination
// A clickable link in the label is impractical because the rect follows
// the cursor; the modifier preview reveals the destination instead.
export type HoverInfo =
  | { mode: "info"; name: string; source: string | null }
  | { mode: "jump"; source: string; commit: string };

type Props = { info: HoverInfo | null };

export default function HoverHighlight(props: Props): React.ReactElement | null {
  if (!props.info) return null;
  return (
    <>
      <div className="sn-hover" data-stickynote-ignore="" />
      <div className="sn-hover-card" data-stickynote-ignore="">
        {props.info.mode === "info" ? (
          <>
            <span className="sn-hover-name">&lt;{props.info.name}&gt;</span>
            {props.info.source ? <span>{props.info.source}</span> : null}
          </>
        ) : (
          <>
            <span>jump to </span>
            <span className="sn-hover-link">
              {props.info.source}[{props.info.commit.slice(0, 7)}]
            </span>
          </>
        )}
      </div>
    </>
  );
}
