// All overlay CSS lives here as a single string and is injected into the
// overlay's Shadow DOM. Avoids Vue SFC <style> extraction during pack (which
// would split CSS into a separate file the consumer would have to load).
export const OVERLAY_CSS = `
.sn-root, .sn-root * {
  box-sizing: border-box;
}

.sn-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483000;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: #111827;
  font-size: 13px;
  line-height: 1.4;
}

.sn-statusbar {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 9999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
}
.sn-statusbar button {
  font: inherit;
  color: inherit;
  border: none;
  background: transparent;
  padding: 2px 8px;
  border-radius: 9999px;
  cursor: pointer;
}
.sn-statusbar button:hover { background: #f3f4f6; }
.sn-statusbar button.sn-active { background: #ede9fe; color: #5b21b6; }
.sn-title { font-weight: 600; }
.sn-badge {
  background: #fef3c7;
  color: #92400e;
  padding: 2px 6px;
  border-radius: 9999px;
  font-size: 11px;
}
.sn-commit {
  font-family: ui-monospace, monospace;
  color: #6b7280;
  font-size: 11px;
}

/* Inspector hover */
.sn-inspect-rect {
  position: fixed;
  pointer-events: none;
  border: 2px solid #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
  border-radius: 2px;
  transition: all 60ms linear;
  z-index: 2147483100;
}
.sn-inspect-label {
  position: fixed;
  pointer-events: none;
  background: #1f2937;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  display: flex;
  gap: 8px;
  align-items: center;
  z-index: 2147483101;
  white-space: nowrap;
}
.sn-inspect-label .sn-name { color: #c4b5fd; }
.sn-inspect-label a {
  color: #93c5fd;
  text-decoration: underline;
  pointer-events: auto;
}

/* Pins */
.sn-pin {
  position: fixed;
  width: 28px;
  height: 28px;
  margin-left: -14px;
  margin-top: -28px;
  border: none;
  border-radius: 14px 14px 14px 0;
  background: #f59e0b;
  color: white;
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483050;
}
.sn-pin.sn-pin-resolved { background: #10b981; }
.sn-pin.sn-pin-stale { background: #6b7280; opacity: 0.6; }
.sn-pin:hover { transform: scale(1.1); }

/* Stale pin tray */
.sn-stale-tray {
  position: fixed;
  top: 80px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: auto;
  max-width: 220px;
}
.sn-stale-tray .sn-pin { position: relative; margin: 0; }

/* Panel */
.sn-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  max-width: 90vw;
  height: 100vh;
  background: white;
  border-left: 1px solid #e5e7eb;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  z-index: 2147483080;
}
.sn-panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sn-panel-header h2 { font-size: 14px; margin: 0; }
.sn-panel-actions { display: flex; gap: 6px; align-items: center; }
.sn-panel-actions button {
  border: 1px solid #e5e7eb;
  background: white;
  color: #374151;
  padding: 4px 8px;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}
.sn-panel-actions button:hover { background: #f9fafb; }
.sn-panel-actions button.sn-active { background: #ede9fe; border-color: #c4b5fd; color: #5b21b6; }
.sn-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sn-section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b7280;
  margin: 8px 0 4px;
}
.sn-empty {
  color: #9ca3af;
  font-style: italic;
  padding: 8px 0;
}
.sn-thread-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  background: white;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sn-thread-card:hover { border-color: #c4b5fd; }
.sn-thread-card.sn-active-thread { border-color: #8b5cf6; box-shadow: 0 0 0 2px #ede9fe; }
.sn-thread-card.sn-thread-stale { background: #f9fafb; }
.sn-thread-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  color: #6b7280;
}
.sn-thread-meta .sn-comp {
  font-family: ui-monospace, monospace;
  color: #374151;
}
.sn-thread-body {
  color: #111827;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Detail */
.sn-detail-back {
  background: transparent;
  border: none;
  color: #6b7280;
  font: inherit;
  cursor: pointer;
  padding: 0;
}
.sn-detail-back:hover { color: #111827; }
.sn-detail-meta {
  font-size: 11px;
  color: #6b7280;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.sn-detail-meta a { color: #3b82f6; }
.sn-comments {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sn-comment {
  border: 1px solid #f3f4f6;
  border-radius: 6px;
  padding: 8px 10px;
}
.sn-comment.sn-deleted { color: #9ca3af; font-style: italic; }
.sn-comment-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}
.sn-comment-author { font-weight: 600; color: #111827; }
.sn-comment-actions {
  display: flex;
  gap: 6px;
}
.sn-comment-actions button {
  background: transparent;
  border: none;
  color: #6b7280;
  font: inherit;
  cursor: pointer;
  padding: 0;
}
.sn-comment-actions button:hover { color: #ef4444; }

/* Forms */
.sn-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sn-form textarea {
  font: inherit;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
  resize: vertical;
  min-height: 70px;
  width: 100%;
}
.sn-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.sn-form-actions button {
  font: inherit;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.sn-form-actions button.sn-primary {
  background: #8b5cf6;
  color: white;
  border-color: #8b5cf6;
}
.sn-form-actions button.sn-primary:disabled {
  background: #c4b5fd;
  border-color: #c4b5fd;
  cursor: not-allowed;
}

/* Composer for new pin */
.sn-composer-overlay {
  position: fixed;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 12px;
  width: 320px;
  pointer-events: auto;
  z-index: 2147483120;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sn-composer-target {
  font-size: 11px;
  color: #6b7280;
  font-family: ui-monospace, monospace;
}
`;
