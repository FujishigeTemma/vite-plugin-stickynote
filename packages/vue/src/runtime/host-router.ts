import { shallowRef, type ShallowRef } from "vue";

// Subscribes to Vue's devtools channel (`__VUE_DEVTOOLS_GLOBAL_HOOK__`) to
// discover the host's vue-router. Vue emits `app:init` from `app.mount()`
// — after `app.use(router)` has populated `globalProperties.$router` — and
// buffers the event when no hook is installed yet, replaying it via
// `__VUE_DEVTOOLS_HOOK_REPLAY__`. So this works regardless of script
// order vs. the host entry.

type RouteSnap = { fullPath: string; matched: { path: string }[] };

export type HostRouter = {
  currentRoute: { value: RouteSnap };
  afterEach: (cb: (to: RouteSnap) => void) => () => void;
};

type VueAppLike = { config?: { globalProperties?: { $router?: HostRouter } } };
type Listener = (...args: unknown[]) => void;

type DevtoolsHook = {
  id?: string;
  devtoolsVersion?: string;
  enabled: boolean;
  events: Map<string, Listener[]>;
  apps: unknown[];
  on: (event: string, fn: Listener) => void;
  emit: (event: string, ...args: unknown[]) => void;
};

type DevtoolsGlobal = {
  __VUE_DEVTOOLS_GLOBAL_HOOK__?: DevtoolsHook;
  __VUE_DEVTOOLS_HOOK_REPLAY__?: ((hook: DevtoolsHook) => void)[] | null;
};

const HOOK_KEY = "__VUE_DEVTOOLS_GLOBAL_HOOK__";

export const hostRouter: ShallowRef<HostRouter | null> = shallowRef(null);

let installed = false;

export function installHostRouterHook(): void {
  if (installed) return;
  installed = true;

  const target = window as unknown as DevtoolsGlobal;
  const existing = target[HOOK_KEY];
  const hook = existing ?? createHook();

  // The overlay's own `app:init` lacks `$router` and falls through here.
  hook.on("app:init", (app) => {
    const router = (app as VueAppLike)?.config?.globalProperties?.$router;
    if (router) hostRouter.value = router;
  });

  hook.on("app:unmount", (app) => {
    const router = (app as VueAppLike)?.config?.globalProperties?.$router;
    if (router && router === hostRouter.value) hostRouter.value = null;
  });

  if (!existing) {
    Object.defineProperty(target, HOOK_KEY, {
      value: hook,
      writable: true,
      configurable: true,
    });
    // Drain events buffered by Vue while no hook was installed.
    const replay = target.__VUE_DEVTOOLS_HOOK_REPLAY__;
    if (Array.isArray(replay)) {
      for (const cb of replay) cb(hook);
      target.__VUE_DEVTOOLS_HOOK_REPLAY__ = null;
    }
  }
}

function createHook(): DevtoolsHook {
  const events = new Map<string, Listener[]>();
  // `id` + `devtoolsVersion` mark this as v7 so a later `@vue/devtools`
  // install doesn't take its legacy-hook compat path and `Object.assign`
  // over our `events` map.
  return {
    id: "vite-plugin-stickynote",
    devtoolsVersion: "7.0",
    enabled: true,
    events,
    apps: [],
    on(event, fn) {
      const list = events.get(event);
      if (list) list.push(fn);
      else events.set(event, [fn]);
    },
    emit(event, ...args) {
      const list = events.get(event);
      if (!list) return;
      for (const fn of list) fn(...args);
    },
  };
}
