import { useEffect, useRef } from "react";

import { useDomTracker } from "../dom-tracker.ts";
import { useStore } from "../store.ts";
import Inspector from "./Inspector.tsx";
import Panel from "./Panel.tsx";
import PinLayer from "./PinLayer.tsx";
import StalePinTray from "./StalePinTray.tsx";
import StatusBar from "./StatusBar.tsx";
import "./tokens.css";
import "./styles.css";

export default function App(): React.ReactElement | null {
  const active = useStore((s) => s.active);
  const toggleActive = useStore((s) => s.toggleActive);
  // Composer-layer ref. The Inspector renders its composer into this div
  // via React portal — this is the React equivalent of Vue's `<Teleport
  // to=".sn-composer-layer" defer>`.
  const composerLayerRef = useRef<HTMLDivElement | null>(null);

  useDomTracker();

  // Cmd/Ctrl + . toggles the overlay. Capture phase so we hear it even
  // if the host app stops propagation.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      // Match by `code` too — some IMEs / layouts produce different `key`
      // values when Meta is held.
      const isPeriod = e.key === "." || e.code === "Period";
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && isPeriod) {
        e.preventDefault();
        e.stopPropagation();
        toggleActive();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [toggleActive]);

  if (!active) return null;

  // DOM order inside `.sn-root` *is* the stack order. Earlier siblings
  // render behind later ones. Inspector renders its own selection / hover
  // highlight overlays first (in that order: selection below, hover above),
  // so they end up at the very bottom of the stack. Pins, tray, status,
  // and panel layer on top. The composer is portaled into the trailing
  // `.sn-composer-layer` div so it sits at the very top, above everything.
  return (
    <div className="sn-root">
      <Inspector composerLayerRef={composerLayerRef} />
      <PinLayer />
      <StalePinTray />
      <StatusBar />
      <Panel />
      <div className="sn-composer-layer" ref={composerLayerRef} />
    </div>
  );
}
