# Errors, Boundaries, And Not Found

## Primary Sources

- Vue Router docs: Data Loader error handling [13]
- Vue docs: `<Suspense>` [4]
- Vue Router docs: File-Based Routing [6]
- TanStack Query docs: `QueryCache` [30]

## Use One Error Taxonomy

Handle errors by where they belong:

- route mismatch: catch-all `[...path].vue` route [6]
- missing resource with a known route: explicit 404 route or expected loader error
- route-critical unexpected loader failure: Vue Router global error flow via `router.onError()` [13]
- expected blocking-loader failure: loader `error` property via the `errors` option [13]
- Suspense-owned async setup or query failure: parent `onErrorCaptured()` above the Suspense boundary [4]
- background refetch failure with stale data still present: non-blocking inline notice or toast

Do not scatter custom `if (isError)` branches across every component when a boundary or route error path already owns the failure mode.

## Use Expected Loader Errors For Granular Control

Vue Router's Data Loader error docs explicitly distinguish unexpected errors from expected ones [13]. Unexpected errors abort navigation and go to `router.onError()`. Expected loader errors can be kept in the loader's `error` property so the page can render a known failure state instead of crashing the navigation.

## Use Error Capture Above Suspense

Vue's Suspense guide explicitly says Suspense does not provide error handling by itself and recommends `onErrorCaptured()` in the parent component of the Suspense boundary [4].

That means your error boundary for Suspense-owned failures is not the Suspense component itself. Put error capture in the parent layer that owns the boundary.

## Configure Not Found Deliberately

Vue Router file-based routing gives you catch-all routes via `[...path].vue` [6]. Use that deliberately as the route-level not-found entry point.

For "the route exists but the resource does not", pick one policy and keep it consistent:

- reroute to a 404 route from the loader
- or keep it as an expected loader error and render a local not-found state

Do not mix both approaches randomly across pages.

## Keep Background Refetch Failures Non-Destructive

If stale data is already on screen and a background refetch fails, keep the stale data visible. Surface the problem from query or loader error state, or from a global `QueryCache.onError` notification path, without collapsing the entire route [30].

## Design A Hybrid Error Strategy

Combine multiple layers for a complete strategy:

- background refetch errors: toast or inline notice via `QueryCache.onError`, keep stale data visible [30]
- initial blocking-loader errors: route-level error flow
- expected route errors: loader `error` state
- Suspense-owned async errors: parent `onErrorCaptured()`

## Put The Fallback In The Right Layer

Use:

- catch-all routes for unknown URLs
- loader error paths for route-critical load failures
- Suspense fallback for waiting
- error capture above Suspense for async failures

Do not use one giant app-level catch-all for every failure mode.
