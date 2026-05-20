import { useStore } from "../store.ts";
import HelpButton from "./HelpButton.tsx";

export default function StatusBar(): React.ReactElement {
  const noRouter = useStore((s) => s.noRouter);
  const panelOpen = useStore((s) => s.panelOpen);
  const togglePanel = useStore((s) => s.togglePanel);
  const options = useStore((s) => s.options);

  const dirtyBadge = options?.dirtyBuild ? "local changes" : null;
  const shortCommit = options?.commitHash.slice(0, 7) ?? "";

  return (
    <div className="sn-statusbar">
      {noRouter ? (
        <span
          className="sn-badge sn-badge-danger"
          title="TanStack Router not detected — threads will save under stale routes. Ensure the host app uses @tanstack/react-router."
        >
          no router
        </span>
      ) : null}
      {dirtyBadge ? <span className="sn-badge">{dirtyBadge}</span> : null}
      <span className="sn-commit">{shortCommit}</span>
      <HelpButton />
      <button
        type="button"
        className={panelOpen ? "sn-active" : ""}
        title="Toggle panel"
        onClick={togglePanel}
      >
        threads
      </button>
    </div>
  );
}
