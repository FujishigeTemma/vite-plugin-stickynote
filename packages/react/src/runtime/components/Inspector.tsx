import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { clearAnchor, stampAnchor } from "../anchor-binding.ts";
import { useKeyModifier } from "../hooks/useKeyModifier.ts";
import {
  ancestorsWithInspector,
  buildGithubUrl,
  clamp,
  componentKey,
  defaultDepthFor,
  elementDisplayName,
  findOccurrenceIndex,
  getInspectorData,
  nearestComponentRoot,
  parseInspector,
  sameComponent,
} from "../inspector.ts";
import { serverMutations } from "../mutations.ts";
import { isJumpModifier } from "../platform.ts";
import { queryClient } from "../query-client.ts";
import { useStore } from "../store.ts";
import type { Component } from "../types.ts";
import HoverHighlight, { type HoverInfo } from "./HoverHighlight.tsx";
import SelectionLayer from "./SelectionLayer.tsx";

const HOVER_ANCHOR = "--sn-hover";

// Pre-persistence form of a component pick: server assigns `id` and
// `display_order` at insert time.
type SelectedComponent = Omit<Component, "id" | "display_order">;

type ComposerState = {
  visible: boolean;
  body: string;
  rect: { left: number; top: number; width: number; height: number } | null;
  pinX: number;
  pinY: number;
  // components[0] is the anchor (pin coords are relative to it) and
  // cannot be removed; later entries are shift+click-added extras and
  // can be toggled off.
  components: SelectedComponent[];
  dialogX: number;
  dialogY: number;
};

const EMPTY_COMPOSER: ComposerState = {
  visible: false,
  body: "",
  rect: null,
  pinX: 0,
  pinY: 0,
  components: [],
  dialogX: 0,
  dialogY: 0,
};

type Props = {
  composerLayerRef: React.RefObject<HTMLDivElement | null>;
};

export default function Inspector(props: Props): React.ReactElement {
  const options = useStore((s) => s.options);
  const domVersion = useStore((s) => s.domVersion);
  const toggleActive = useStore((s) => s.toggleActive);

  const createThread = useMutation(serverMutations.threads.create(), queryClient);

  const [composer, setComposer] = useState<ComposerState>(EMPTY_COMPOSER);

  // Hover state. Refs (not state) for high-frequency values to avoid
  // re-rendering on every mousemove; we re-render via `pickVersion`
  // when the recomputed pick actually changes.
  const lastEventRef = useRef<MouseEvent | null>(null);
  const lastInnermostRef = useRef<Element | null>(null);
  const depthRef = useRef(0);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  const metaMod = useKeyModifier("Meta");
  const ctrlMod = useKeyModifier("Control");

  const eventInOverlay = (e: Event): boolean => {
    const t = e.target;
    return t instanceof Element && !!t.closest("[data-stickynote-ignore]");
  };

  type Pick = {
    el: HTMLElement;
    data: string;
    path: string;
    line: number;
  };

  // Reactive pick of the element under the cursor at the current depth.
  // `void domVersion` subscribes to host-DOM mutations so the pick auto-
  // refreshes after HMR / list re-renders. `v_for_index` is intentionally
  // NOT computed here: `findOccurrenceIndex` is a document-wide
  // querySelectorAll, and the hover path fires on every mouseover. Pay
  // that cost only on click.
  const pick = useMemo<Pick | null>(() => {
    void domVersion;
    void tick;
    const ev = lastEventRef.current;
    if (!ev || !(ev.target instanceof Element)) return null;
    const chain = ancestorsWithInspector(ev.target);
    if (chain.length === 0) return null;
    const idx = Math.min(Math.max(depthRef.current, 0), chain.length - 1);
    const el = chain[idx];
    if (!(el instanceof HTMLElement)) return null;
    const data = getInspectorData(el);
    const info = parseInspector(data);
    if (!info || !data) return null;
    return { el, data, path: info.path, line: info.line };
  }, [domVersion, tick]);

  const jumpModifierActive = (e?: MouseEvent | KeyboardEvent): boolean => {
    return isJumpModifier({
      metaKey: !!metaMod || !!e?.metaKey,
      ctrlKey: !!ctrlMod || !!e?.ctrlKey,
    });
  };

  const hoverInfo = useMemo<HoverInfo | null>(() => {
    const ev = lastEventRef.current;
    if (!ev || !options || eventInOverlay(ev)) return null;
    if (!pick) return null;
    const githubUrl = buildGithubUrl(options.githubRepo, options.commitHash, pick.path, pick.line);
    if (jumpModifierActive(ev) && githubUrl) {
      return {
        mode: "jump",
        source: `${pick.path}:${pick.line}`,
        commit: options.commitHash,
      };
    }
    return {
      mode: "info",
      name: elementDisplayName(pick.el),
      source: `${pick.path}:${pick.line}`,
    };
    // metaMod / ctrlMod read inside `jumpModifierActive`; declare them so
    // the memo recomputes when the modifier flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, options, metaMod, ctrlMod]);

  // Stamp / clear the CSS anchor whenever the picked element changes. The
  // stamp itself is a side effect on the host DOM.
  const stampedElRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const next = hoverInfo ? (pick?.el ?? null) : null;
    if (next === stampedElRef.current) return;
    clearAnchor(stampedElRef.current, HOVER_ANCHOR);
    if (next) stampAnchor(next, HOVER_ANCHOR);
    stampedElRef.current = next;
  }, [hoverInfo, pick]);

  // Cleanup hover anchor on unmount.
  useEffect(() => {
    return () => {
      clearAnchor(stampedElRef.current, HOVER_ANCHOR);
      stampedElRef.current = null;
    };
  }, []);

  // Global capture-phase listeners. Matches React DevTools' Highlighter
  // pattern (`react-devtools-shared/src/backend/views/Highlighter/index.js:
  // 119-132`): capture so we observe events before host React's synthetic
  // event system delegates, and we call `stopPropagation` on click to keep
  // host handlers from firing.
  useEffect(() => {
    const onMouseOver = (e: MouseEvent): void => {
      lastEventRef.current = e;
      const target = e.target instanceof Element ? e.target : null;
      const newInnermost = target ? nearestComponentRoot(target) : null;
      if (newInnermost !== lastInnermostRef.current) {
        lastInnermostRef.current = newInnermost;
        const chain = target ? ancestorsWithInspector(target) : [];
        depthRef.current = target ? defaultDepthFor(target, chain) : 0;
      }
      bump();
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        if (composerVisibleRef.current) closeComposer();
        else toggleActive();
        return;
      }
      // Alt+ArrowUp/Down: step depth. Require Alt as the sole modifier so
      // we don't collide with Cmd-arrow word navigation or browser
      // Alt+Shift combos.
      if (!e.altKey || e.shiftKey || e.metaKey || e.ctrlKey) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const ev = lastEventRef.current;
      if (!ev || !(ev.target instanceof Element)) return;
      const chain = ancestorsWithInspector(ev.target);
      if (chain.length === 0) return;
      // Capture-phase listener consumes the key before inputs see it, so
      // a focused textarea doesn't move its caret while inspecting.
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "ArrowUp") {
        depthRef.current = Math.min(depthRef.current + 1, chain.length - 1);
      } else {
        depthRef.current = Math.max(depthRef.current - 1, 0);
      }
      bump();
    };

    document.addEventListener("mouseover", onMouseOver, { capture: true });
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      document.removeEventListener("mouseover", onMouseOver, { capture: true });
      window.removeEventListener("keydown", onKey, { capture: true });
    };
    // toggleActive / closeComposer reads here are stable refs to setters
    // and module-level helpers; the bumper is intentionally a deps target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bump]);

  // Click handler must read live state (composer, pick, options) without
  // being recreated on every render — recreating would tear down and
  // re-add the capture listener and break the in-flight click sequence.
  // Refs carry the live values.
  const composerVisibleRef = useRef(false);
  const composerComponentsRef = useRef<SelectedComponent[]>([]);
  composerVisibleRef.current = composer.visible;
  composerComponentsRef.current = composer.components;

  const closeComposer = useCallback((): void => {
    setComposer(EMPTY_COMPOSER);
  }, []);

  const pickRef = useRef<Pick | null>(null);
  pickRef.current = pick;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const onClickCapture = (e: MouseEvent): void => {
      if (eventInOverlay(e)) return;
      // capture-phase preventDefault also suppresses host <a> navigation,
      // so the jump path's window.open is the only navigation that runs.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Pin the highlighted element, not e.target — depth may have stepped
      // away.
      const p = pickRef.current;
      const opts = optionsRef.current;
      if (!p || !opts) return;

      // Cmd/Ctrl+click: jump to source on GitHub. The hover label can't
      // host a clickable link (it follows the cursor), so the affordance
      // lives on the highlighted rect itself via this modifier.
      if (isJumpModifier({ metaKey: e.metaKey, ctrlKey: e.ctrlKey })) {
        const url = buildGithubUrl(opts.githubRepo, opts.commitHash, p.path, p.line);
        if (url) window.open(url, "_blank", "noopener");
        return;
      }

      const sel: SelectedComponent = {
        path: p.path,
        line: p.line,
        v_for_index: findOccurrenceIndex(p.el, p.data),
        name: elementDisplayName(p.el),
      };

      // Shift+click with composer open: Finder-style multi-select.
      // Toggle the component in/out. The first element is the pin anchor
      // and cannot be removed by shift+clicking it again.
      if (e.shiftKey && composerVisibleRef.current && composerComponentsRef.current.length > 0) {
        const primary = composerComponentsRef.current[0];
        if (primary && sameComponent(primary, sel)) return;
        const existingIdx = composerComponentsRef.current.findIndex(
          (c, idx) => idx > 0 && sameComponent(c, sel),
        );
        setComposer((prev) => {
          const next = [...prev.components];
          if (existingIdx >= 0) next.splice(existingIdx, 1);
          else next.push(sel);
          return { ...prev, components: next };
        });
        return;
      }

      // Snapshot the rect at pick time: the click→ratio must reflect the
      // element's position when the user picked, not when they submit.
      const r = p.el.getBoundingClientRect();
      setComposer({
        visible: true,
        body: "",
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        pinX: e.clientX,
        pinY: e.clientY,
        dialogX: Math.min(window.innerWidth - 340, Math.max(0, e.clientX + 12)),
        dialogY: Math.min(window.innerHeight - 220, Math.max(0, e.clientY + 12)),
        components: [sel],
      });
    };

    document.addEventListener("click", onClickCapture, { capture: true });
    return () => document.removeEventListener("click", onClickCapture, { capture: true });
  }, []);

  const removeAdditional = (i: number): void => {
    // i + 1 because index 0 is the pin anchor and cannot be removed.
    setComposer((prev) => {
      const next = [...prev.components];
      next.splice(i + 1, 1);
      return { ...prev, components: next };
    });
  };

  const submitComposer = (): void => {
    const primary = composer.components[0];
    if (!primary || !composer.rect || !options) return;
    if (!composer.body.trim()) return;
    const x_ratio = (composer.pinX - composer.rect.left) / composer.rect.width;
    const y_ratio = (composer.pinY - composer.rect.top) / composer.rect.height;
    createThread.mutate(
      {
        commit_hash: options.commitHash,
        dirty_build: options.dirtyBuild,
        x_ratio: clamp(x_ratio),
        y_ratio: clamp(y_ratio),
        viewport_w: window.innerWidth,
        viewport_h: window.innerHeight,
        components: composer.components.map((c) => ({
          path: c.path,
          line: c.line,
          v_for_index: c.v_for_index,
          name: c.name,
        })),
        body: composer.body,
      },
      {
        onSuccess: () => closeComposer(),
      },
    );
  };

  const onComposerKeydown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      composerFormRef.current?.requestSubmit();
    }
  };

  // Composer drag (click+drag on the target chip header to reposition).
  const composerDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    composerDragRef.current = {
      offsetX: e.clientX - composer.dialogX,
      offsetY: e.clientY - composer.dialogY,
    };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const drag = composerDragRef.current;
    if (!drag) return;
    setComposer((prev) => ({
      ...prev,
      dialogX: Math.min(window.innerWidth - 340, Math.max(0, e.clientX - drag.offsetX)),
      dialogY: Math.min(window.innerHeight - 220, Math.max(0, e.clientY - drag.offsetY)),
    }));
  };
  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    composerDragRef.current = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };

  const composerFormRef = useRef<HTMLFormElement | null>(null);

  const primaryComponent = composer.components[0] ?? null;
  const selectionPicks =
    composer.visible && composer.components.length > 0 ? composer.components : [];

  const composerLayer = props.composerLayerRef.current;

  return (
    <>
      {/* DOM order inside .sn-root is the stack order. SelectionLayer first
          (below) then HoverHighlight (above), so the live hover sits on top
          of the persistent selection rectangles. */}
      <SelectionLayer composerPicks={selectionPicks} />
      <HoverHighlight info={hoverInfo} />

      {composer.visible && composer.rect && primaryComponent && composerLayer
        ? createPortal(
            <div
              className="sn-composer-overlay"
              style={{ left: `${composer.dialogX}px`, top: `${composer.dialogY}px` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="sn-composer-target"
                onPointerDown={onHandlePointerDown}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
              >
                <div className="sn-composer-primary">
                  ★ {primaryComponent.name} · {primaryComponent.path}:{primaryComponent.line} (#
                  {primaryComponent.v_for_index})
                </div>
                {composer.components.length > 1 ? (
                  <div className="sn-composer-additional">
                    {composer.components.slice(1).map((c, i) => (
                      <div key={componentKey(c)} className="sn-chip">
                        <span className="sn-chip-text">
                          {c.name} · {c.path}:{c.line} (#{c.v_for_index})
                        </span>
                        <button
                          type="button"
                          className="sn-chip-remove"
                          aria-label="remove"
                          onClick={() => removeAdditional(i)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="sn-composer-hint">shift+click to link more components</div>
              </div>
              <form
                ref={composerFormRef}
                className="sn-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitComposer();
                }}
              >
                <textarea
                  autoFocus
                  value={composer.body}
                  placeholder="Leave a comment…"
                  onChange={(e) => setComposer((prev) => ({ ...prev, body: e.target.value }))}
                  onKeyDown={onComposerKeydown}
                />
                <div className="sn-form-actions">
                  <button type="button" onClick={closeComposer}>
                    cancel
                  </button>
                  <button
                    type="submit"
                    className="sn-primary"
                    disabled={createThread.isPending || !composer.body.trim()}
                  >
                    {createThread.isPending ? "Saving…" : "Pin"}
                  </button>
                </div>
              </form>
            </div>,
            composerLayer,
          )
        : null}
    </>
  );
}
