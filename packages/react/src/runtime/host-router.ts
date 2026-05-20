import { useStore } from "./store.ts";

// TanStack Router exposes itself globally in its constructor
// (`router-core/src/router.ts:1010`: `self.__TSR_ROUTER__ = this`). We
// rely on that singleton because the overlay lives outside the host
// React tree and therefore can't use the `useRouter()` hook the way
// `@tanstack/react-router-devtools` does. The pubsub API
// (`router.subscribe('onResolved', fn)`) is the same one the DevTools
// adapter ends up calling via React's commit cycle, so we get
// equivalent change notifications without depending on context.

// Minimal structural typing — we don't want to import the @tanstack/
// react-router type surface into a runtime that the consumer's bundle
// compiles. Only the fields we actually read are declared.
type TSRMatch = {
  fullPath?: string;
  pathname?: string;
};

type TSRState = {
  matches: TSRMatch[];
};

type TSRRouter = {
  state: TSRState;
  subscribe: (event: "onResolved", fn: () => void) => () => void;
};

declare global {
  interface Window {
    __TSR_ROUTER__?: TSRRouter;
  }
}

// Defer the "no router" verdict a tick so a router construction that
// races our mount still has a chance to populate `__TSR_ROUTER__` first.
const NO_ROUTER_GRACE_MS = 500;
const POLL_INTERVAL_MS = 50;

function pickPath(input: string): string {
  return input.split(/[?#]/, 1)[0] ?? input;
}

function deepestFullPath(router: TSRRouter): string {
  const matches = router.state.matches;
  // Walk deepest-first to skip layout records without a `fullPath` (e.g.
  // `__root` or wrapper-only segments). For TSR file-based routing,
  // `fullPath` is the route pattern like `/services/$serviceId`.
  for (let i = matches.length - 1; i >= 0; i--) {
    const fp = matches[i]?.fullPath;
    if (fp) return fp;
  }
  return pickPath(window.location.pathname);
}

// One-time install. Returns an `unmount` that tears down the polling
// timer, grace-verdict timer, and router subscription.
export function installHostRouterSubscription(): () => void {
  const { setCurrentRoute, setNoRouter } = useStore.getState();

  let unsubscribe: (() => void) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let verdictTimer: ReturnType<typeof setTimeout> | null = null;

  const attach = (router: TSRRouter): void => {
    setNoRouter(false);
    setCurrentRoute(deepestFullPath(router));
    unsubscribe = router.subscribe("onResolved", () => {
      setCurrentRoute(deepestFullPath(router));
    });
  };

  const tryAttach = (): boolean => {
    const router = window.__TSR_ROUTER__;
    if (!router) return false;
    attach(router);
    return true;
  };

  if (!tryAttach()) {
    // Poll for a short window in case the router is constructed after we
    // mount (script-injection order is consumer-controlled).
    pollTimer = setInterval(() => {
      if (tryAttach() && pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, POLL_INTERVAL_MS);

    verdictTimer = setTimeout(() => {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (!window.__TSR_ROUTER__) setNoRouter(true);
    }, NO_ROUTER_GRACE_MS);
  }

  return (): void => {
    unsubscribe?.();
    if (pollTimer !== null) clearInterval(pollTimer);
    if (verdictTimer !== null) clearTimeout(verdictTimer);
  };
}
