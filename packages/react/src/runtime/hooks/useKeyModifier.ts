import { useEffect, useState } from "react";

// Tracks whether a modifier key (Meta / Control / Shift / Alt) is currently
// held. Reads `evt.getModifierState(...)` on every keydown/keyup/mousedown/
// mouseup so it stays accurate across Cmd+Tab blur and won't get stuck.
//
// Equivalent of `@vueuse/core`'s `useKeyModifier`, kept inline so the React
// runtime doesn't pick up a hook-only dep just for two listeners.
export function useKeyModifier(modifier: "Meta" | "Control" | "Shift" | "Alt"): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const update = (e: KeyboardEvent | MouseEvent): void => {
      // `getModifierState` exists on both KeyboardEvent and MouseEvent.
      setHeld(e.getModifierState(modifier));
    };
    window.addEventListener("keydown", update, true);
    window.addEventListener("keyup", update, true);
    window.addEventListener("mousedown", update, true);
    window.addEventListener("mouseup", update, true);
    return () => {
      window.removeEventListener("keydown", update, true);
      window.removeEventListener("keyup", update, true);
      window.removeEventListener("mousedown", update, true);
      window.removeEventListener("mouseup", update, true);
    };
  }, [modifier]);

  return held;
}
