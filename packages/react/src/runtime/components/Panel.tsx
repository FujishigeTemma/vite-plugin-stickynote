import { useStore } from "../store.ts";
import ThreadDetail from "./ThreadDetail.tsx";
import ThreadList from "./ThreadList.tsx";

export default function Panel(): React.ReactElement | null {
  const panelOpen = useStore((s) => s.panelOpen);
  const openThreadId = useStore((s) => s.openThreadId);
  const showResolved = useStore((s) => s.showResolved);
  const setShowResolved = useStore((s) => s.setShowResolved);
  const closePanel = useStore((s) => s.closePanel);

  if (!panelOpen) return null;
  return (
    <aside className="sn-panel">
      <header className="sn-panel-header">
        <h2>{openThreadId ? "Thread" : "Threads"}</h2>
        <div className="sn-panel-actions">
          {!openThreadId ? (
            <button
              type="button"
              className={showResolved ? "sn-active" : ""}
              onClick={() => setShowResolved(!showResolved)}
            >
              show resolved
            </button>
          ) : null}
          <button type="button" onClick={closePanel}>
            close
          </button>
        </div>
      </header>
      <div className="sn-panel-body">{openThreadId ? <ThreadDetail /> : <ThreadList />}</div>
    </aside>
  );
}
