import { useStaleThreads, useThreadsList } from "../hooks/useThreadsList.ts";
import { useStore } from "../store.ts";

export default function StalePinTray(): React.ReactElement | null {
  const { visible } = useThreadsList();
  const { stale } = useStaleThreads(visible);
  const openThread = useStore((s) => s.openThread);

  if (stale.length === 0) return null;
  return (
    <div className="sn-stale-tray">
      {stale.map((t) => (
        <button
          key={t.id}
          type="button"
          className="sn-pin sn-pin-stale"
          title={`stale: ${t.components[0]?.path}:${t.components[0]?.line}`}
          onClick={() => openThread(t.id)}
        >
          ?
        </button>
      ))}
    </div>
  );
}
