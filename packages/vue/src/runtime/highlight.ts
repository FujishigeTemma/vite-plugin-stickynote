// Imperative light-DOM highlight overlay, modelled on Vue Devtools'
// component-highlighter. Lives inside `.sn-root` (prepended) so it shares the
// plugin's single stacking context: stack order against the composer / pins /
// panel is decided by DOM order, no internal z-index needed.

const CONTAINER_ID = "__stickynote-inspect-container__";
const CARD_ID = "__stickynote-inspect-card__";
const SELECTION_CONTAINER_ID = "__stickynote-selection-container__";
const ROOT_SELECTOR = ".sn-root";

// Two label modes share the rect overlay:
// - "info" is the default hover label (component name + source location)
// - "jump" appears while Cmd/Ctrl is held to preview the modifier+click
//   action. A clickable link in the label itself is unworkable (it follows
//   the cursor and would jump away before the user reaches it), so the
//   modifier key reveals the destination instead.
export type HighlightOptions = {
  rect: { left: number; top: number; width: number; height: number };
} & (
  | { mode: "info"; name: string; source: string | null }
  | { mode: "jump"; source: string; commit: string }
);

const containerStyle: Partial<CSSStyleDeclaration> = {
  display: "block",
  position: "fixed",
  backgroundColor: "rgba(139, 92, 246, 0.08)",
  border: "2px solid #8b5cf6",
  borderRadius: "2px",
  transition: "all 60ms linear",
  pointerEvents: "none",
  boxSizing: "border-box",
};

const cardStyle: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  left: "-4px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "11px",
  fontWeight: "600",
  lineHeight: "1",
  padding: "4px 8px",
  borderRadius: "4px",
  color: "#fff",
  backgroundColor: "#1f2937",
  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  display: "flex",
  gap: "8px",
  alignItems: "center",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

function buildContainer(): HTMLDivElement | null {
  const root = document.querySelector(ROOT_SELECTOR);
  if (!root) return null;
  const el = document.createElement("div");
  el.id = CONTAINER_ID;
  el.setAttribute("data-stickynote-ignore", "");
  Object.assign(el.style, containerStyle);
  const card = document.createElement("div");
  card.id = CARD_ID;
  Object.assign(card.style, cardStyle);
  el.appendChild(card);
  // Keep both highlight containers at the bottom of `.sn-root` (so pins /
  // composer / panel naturally render above), but place the hover container
  // immediately after the selection container so hover stays on top of
  // selection — matches the previous z-index ordering.
  const selection = document.getElementById(SELECTION_CONTAINER_ID);
  if (selection && selection.parentElement === root) selection.after(el);
  else root.prepend(el);
  return el;
}

function getContainer(): HTMLDivElement | null {
  return document.getElementById(CONTAINER_ID) as HTMLDivElement | null;
}

export function showHighlight(opts: HighlightOptions): void {
  const container = getContainer() ?? buildContainer();
  if (!container) return;
  container.style.display = "block";
  container.style.left = `${Math.round(opts.rect.left * 100) / 100}px`;
  container.style.top = `${Math.round(opts.rect.top * 100) / 100}px`;
  container.style.width = `${Math.round(opts.rect.width * 100) / 100}px`;
  container.style.height = `${Math.round(opts.rect.height * 100) / 100}px`;

  const card = container.firstElementChild as HTMLDivElement;
  // Tuck the label below the rect if it would clip off the top.
  card.style.top = opts.rect.top < 28 ? `${opts.rect.height + 4}px` : "-28px";

  card.innerHTML = "";
  if (opts.mode === "jump") {
    card.appendChild(textSpan("jump to "));
    const linkLike = textSpan(`${opts.source}[${opts.commit.slice(0, 7)}]`);
    linkLike.style.color = "#93c5fd";
    linkLike.style.textDecoration = "underline";
    card.appendChild(linkLike);
  } else {
    const nameEl = textSpan(`<${opts.name}>`);
    nameEl.style.color = "#c4b5fd";
    card.appendChild(nameEl);
    if (opts.source) card.appendChild(textSpan(opts.source));
  }
}

function textSpan(text: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.textContent = text;
  return el;
}

export function hideHighlight(): void {
  const el = getContainer();
  if (el) el.style.display = "none";
}

export function removeHighlight(): void {
  const el = getContainer();
  el?.remove();
  const sel = document.getElementById(SELECTION_CONTAINER_ID);
  sel?.remove();
}

// Persistent multi-component selection overlay used while the composer is
// open. Visually subordinate to the live hover highlight so the cursor's
// current target stays readable.
export type SelectionRect = {
  key: string;
  rect: { left: number; top: number; width: number; height: number };
  label: string;
};

const selectionContainerStyle: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  inset: "0",
  pointerEvents: "none",
};

const selectionItemStyle: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  border: "2px solid #f97316",
  borderRadius: "2px",
  backgroundColor: "rgba(249, 115, 22, 0.08)",
  boxSizing: "border-box",
  pointerEvents: "none",
  transition: "all 60ms linear",
};

const selectionLabelStyle: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  left: "-2px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "10px",
  fontWeight: "600",
  lineHeight: "1",
  padding: "3px 6px",
  borderRadius: "3px",
  color: "#fff",
  backgroundColor: "#ea580c",
  boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

function ensureSelectionContainer(): HTMLDivElement | null {
  let el = document.getElementById(SELECTION_CONTAINER_ID) as HTMLDivElement | null;
  if (el) return el;
  const root = document.querySelector(ROOT_SELECTOR);
  if (!root) return null;
  el = document.createElement("div");
  el.id = SELECTION_CONTAINER_ID;
  el.setAttribute("data-stickynote-ignore", "");
  Object.assign(el.style, selectionContainerStyle);
  // Prepend so the selection layer also stays at the bottom of `.sn-root`.
  // Inserted after the hover highlight container (which prepends as well),
  // so hover ends up immediately below selection in DOM order — selection
  // therefore renders just above the hover rect, matching prior behaviour.
  const hover = document.getElementById(CONTAINER_ID);
  if (hover && hover.parentElement === root) root.insertBefore(el, hover);
  else root.prepend(el);
  return el;
}

export function showSelectionHighlights(items: SelectionRect[]): void {
  const container = ensureSelectionContainer();
  if (!container) return;
  const keep = new Set(items.map((i) => i.key));
  for (const child of Array.from(container.children)) {
    if (!keep.has((child as HTMLElement).dataset.key ?? "")) child.remove();
  }
  for (const item of items) {
    let node = container.querySelector<HTMLDivElement>(`[data-key="${CSS.escape(item.key)}"]`);
    if (!node) {
      node = document.createElement("div");
      node.dataset.key = item.key;
      Object.assign(node.style, selectionItemStyle);
      const label = document.createElement("div");
      label.className = "__sn-selection-label";
      Object.assign(label.style, selectionLabelStyle);
      node.appendChild(label);
      container.appendChild(node);
    }
    node.style.left = `${Math.round(item.rect.left * 100) / 100}px`;
    node.style.top = `${Math.round(item.rect.top * 100) / 100}px`;
    node.style.width = `${Math.round(item.rect.width * 100) / 100}px`;
    node.style.height = `${Math.round(item.rect.height * 100) / 100}px`;
    const label = node.querySelector<HTMLDivElement>(".__sn-selection-label");
    if (label) {
      label.textContent = item.label;
      label.style.top = item.rect.top < 22 ? `${item.rect.height + 2}px` : "-22px";
    }
  }
}

export function clearSelectionHighlights(): void {
  const el = document.getElementById(SELECTION_CONTAINER_ID);
  if (el) el.innerHTML = "";
}
