import { ref, type InjectionKey, type Ref } from "vue";
import { buildElementMap, type ElementMap } from "./inspector.ts";

export const TICK_KEY: InjectionKey<Ref<number>> = Symbol("stickynote:tick");
export const ELEMENT_MAP_KEY: InjectionKey<Ref<ElementMap>> = Symbol("stickynote:elements");

export type OverlayCache = {
  tick: Ref<number>;
  elementMap: Ref<ElementMap>;
  start: () => void;
  stop: () => void;
};

// Centralizes DOM-watch wiring so we do one `querySelectorAll` per DOM
// change instead of N tree walks per tick.
export function createOverlayCache(): OverlayCache {
  const tick = ref(0);
  const elementMap = ref<ElementMap>(new Map());

  let posRaf = 0;
  let domRaf = 0;
  let mo: MutationObserver | null = null;
  let ro: ResizeObserver | null = null;

  function rebuildMap(): void {
    elementMap.value = buildElementMap();
  }

  function bumpPosition(): void {
    cancelAnimationFrame(posRaf);
    posRaf = requestAnimationFrame(() => {
      tick.value++;
    });
  }

  function bumpDom(): void {
    cancelAnimationFrame(domRaf);
    domRaf = requestAnimationFrame(() => {
      rebuildMap();
      tick.value++;
    });
  }

  function start(): void {
    rebuildMap();
    window.addEventListener("scroll", bumpPosition, true);
    window.addEventListener("resize", bumpPosition);
    mo = new MutationObserver(bumpDom);
    mo.observe(document.body, { childList: true, subtree: true });
    ro = new ResizeObserver(bumpPosition);
    ro.observe(document.body);
  }

  function stop(): void {
    window.removeEventListener("scroll", bumpPosition, true);
    window.removeEventListener("resize", bumpPosition);
    mo?.disconnect();
    ro?.disconnect();
    cancelAnimationFrame(posRaf);
    cancelAnimationFrame(domRaf);
  }

  return { tick, elementMap, start, stop };
}
