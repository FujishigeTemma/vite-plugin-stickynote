// Shared bus for the host-app-supplied auth getter. `src/client.ts` and
// `src/runtime/api-client.ts` resolve to different module instances (the
// runtime is loaded via virtual modules) so the global is the deliberate
// handshake, mirroring `__STICKYNOTE_MOUNT__` in overlay.tsx.

export type AuthSource = () => string | Promise<string | null> | null;

declare global {
  // eslint-disable-next-line no-var
  var __STICKYNOTE_AUTH_SOURCE__: AuthSource | undefined;
}

export function setAuthSource(source: AuthSource | null): void {
  globalThis.__STICKYNOTE_AUTH_SOURCE__ = source ?? undefined;
}

export function getAuthSource(): AuthSource | undefined {
  return globalThis.__STICKYNOTE_AUTH_SOURCE__;
}

export function clearAuthSource(): void {
  globalThis.__STICKYNOTE_AUTH_SOURCE__ = undefined;
}
