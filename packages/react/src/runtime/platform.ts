// "Jump to source" follows the browser convention for opening links in a
// new tab: Cmd on macOS, Ctrl elsewhere. Shift is reserved for multi-select.
export function isJumpModifier(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

function isMac(): boolean {
  return /Mac|iPhone|iPad/i.test(navigator.userAgent);
}
