import { inject, type InjectionKey } from "vue";
import type { StickynoteStore } from "./state.ts";

export const STORE_KEY: InjectionKey<StickynoteStore> = Symbol("stickynote");

export function useStore(): StickynoteStore {
  const s = inject(STORE_KEY);
  if (!s) {
    throw new Error("[stickynote] store not provided. Did you mount App.vue?");
  }
  return s;
}
