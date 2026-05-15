import { ref, type InjectionKey, type Ref } from "vue";
import { getInspectorData, type ElementMap } from "./inspector.ts";

export const TICK_KEY: InjectionKey<Ref<number>> = Symbol.for("stickynote:tick");
export const ELEMENT_MAP_KEY: InjectionKey<Ref<ElementMap>> = Symbol.for("stickynote:elements");

export type OverlayCache = {
  tick: Ref<number>;
  elementMap: Ref<ElementMap>;
  start: () => void;
  stop: () => void;
};

// Centralizes DOM-watch wiring so we do a single tree walk per layout
// event instead of one walk per pin per tick.
export function createOverlayCache(): OverlayCache {
  const tick = ref(0);
  const elementMap = ref<ElementMap>(new Map());

  let posRaf = 0;
  let domRaf = 0;
  let mo: MutationObserver | null = null;
  let ro: ResizeObserver | null = null;

  function rebuildMap(): void {
    const map: ElementMap = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const el = node as Element;
      const data = getInspectorData(el);
      if (data) {
        const lastColon = data.lastIndexOf(":");
        const key = lastColon === -1 ? data : data.slice(0, lastColon);
        const list = map.get(key);
        if (list) list.push(el);
        else map.set(key, [el]);
      }
      node = walker.nextNode();
    }
    elementMap.value = map;
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
