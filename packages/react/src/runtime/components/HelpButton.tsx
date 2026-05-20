import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SHORTCUTS: ReadonlyArray<{ keys: ReadonlyArray<string>; action: string }> = [
  { keys: ["Cmd/Ctrl", "."], action: "Toggle plugin on/off" },
  { keys: ["Esc"], action: "Close composer / deactivate plugin" },
  { keys: ["Alt", "↑"], action: "Step DOM depth up (parent)" },
  { keys: ["Alt", "↓"], action: "Step DOM depth down (child)" },
  { keys: ["Cmd/Ctrl", "Click"], action: "Jump to source on GitHub" },
  { keys: ["Shift", "Click"], action: "Multi-select components" },
  { keys: ["Cmd/Ctrl", "Enter"], action: "Submit comment" },
];

export default function HelpButton(): React.ReactElement {
  const [open, setOpen] = useState(false);

  // Intercept Escape before Inspector's capture-phase handler so closing
  // the modal doesn't also deactivate the plugin.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open]);

  // Mount the modal directly under .sn-root so it inherits our tokens
  // and stacks above status / pins. We use a query against the live DOM
  // to find the composer layer — this is the React equivalent of Vue's
  // `<Teleport to=".sn-composer-layer" defer>`.
  const target =
    typeof document !== "undefined" ? document.querySelector(".sn-composer-layer") : null;

  return (
    <>
      <button
        type="button"
        className={`sn-help-btn${open ? " sn-active" : ""}`}
        title="Keyboard shortcuts"
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && target
        ? createPortal(
            <div
              className="sn-help-backdrop"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                className="sn-help-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Keyboard shortcuts"
              >
                <div className="sn-help-header">
                  <h2>Keyboard shortcuts</h2>
                  <button
                    type="button"
                    className="sn-help-close"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <dl className="sn-help-list">
                  {SHORTCUTS.flatMap((s) => [
                    <dt key={`${s.action}-keys`}>
                      {s.keys.map((k, i) => (
                        <span key={k} style={{ display: "contents" }}>
                          {i > 0 ? <span className="sn-help-plus">+</span> : null}
                          <kbd>{k}</kbd>
                        </span>
                      ))}
                    </dt>,
                    <dd key={`${s.action}-action`}>{s.action}</dd>,
                  ])}
                </dl>
              </div>
            </div>,
            target,
          )
        : null}
    </>
  );
}
