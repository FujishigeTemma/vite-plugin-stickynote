// Imperative light-DOM highlight overlay, modelled on Vue Devtools'
// component-highlighter. Lives in document.body (not the Shadow DOM) so it
// reliably positions against the host page viewport without containing-block
// or shadow-tree quirks.

const CONTAINER_ID = "__stickynote-inspect-container__";
const CARD_ID = "__stickynote-inspect-card__";

// Two label modes share the rect overlay:
// - "info" is the default hover label (component name + source location)
// - "jump" appears while Shift is held to preview the Shift+click action.
//   A clickable link in the label itself is unworkable (it follows the
//   cursor and would jump away before the user reaches it), so the modifier
//   key reveals the destination instead.
export type HighlightOptions = {
  rect: { left: number; top: number; width: number; height: number };
} & (
  | { mode: "info"; name: string; source: string | null }
  | { mode: "jump"; source: string; commit: string }
);

const containerStyle: Partial<CSSStyleDeclaration> = {
  display: "block",
  position: "fixed",
  zIndex: "2147483640",
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

function buildContainer(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = CONTAINER_ID;
  Object.assign(el.style, containerStyle);
  const card = document.createElement("div");
  card.id = CARD_ID;
  Object.assign(card.style, cardStyle);
  el.appendChild(card);
  document.body.appendChild(el);
  return el;
}

function getContainer(): HTMLDivElement | null {
  return document.getElementById(CONTAINER_ID) as HTMLDivElement | null;
}

export function showHighlight(opts: HighlightOptions): void {
  const container = getContainer() ?? buildContainer();
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
}
