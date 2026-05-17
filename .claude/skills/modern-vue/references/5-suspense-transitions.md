# Suspense And Async Setup

## Primary Sources

- Vue docs: `<Suspense>` [4]
- Vue docs: `<script setup>` [1]
- TanStack Query Vue docs: Suspense [27]
- TanStack Query Vue docs: Query Cancellation [28]

## Understand Suspense Requirements

Vue Suspense waits on async setup and async components [4]. TanStack Query Vue's Suspense guide adds Query-driven async setup on top of that [27]. Fetching data in `onMounted()` and then setting local refs does not participate in Suspense boundaries.

## Build Revealed UI First

Keep already revealed UI visible while new content loads [4]. Put large, durable layout outside Suspense boundaries and place boundaries around the content that can legitimately wait.

Prefer:

- shell outside the boundary
- route content inside the boundary
- nested boundaries for secondary panels only when they can reveal independently without looking broken

## Preserve Revealed UI On Boundary Swaps

Vue's Suspense guide documents that once a boundary is resolved, it only re-enters pending if the root node of the default slot is replaced, and while waiting it can keep the previous default content visible until the `timeout` elapses [4].

Use that deliberately:

- keep route shells stable so only the intended content boundary swaps
- set `timeout="0"` only when immediate fallback is actually the better UX
- prefer showing pending affordances over clearing already revealed content

## Use Async Setup Deliberately

Top-level `await` in `<script setup>` turns the component into an async dependency for Suspense [1][4]. Use that capability deliberately rather than casually.

Good uses:

- awaiting a route-critical Query read inside a Suspense-owned boundary
- composing a small amount of route-local async setup
- bridging a Data Loader-prefetched query into a Suspense-owned component

Bad uses:

- putting the whole page behind one giant async root for convenience
- mixing top-level await with no surrounding Suspense boundary
- replacing a clear Data Loader contract with arbitrary component-local awaits

## Use Query Suspense For Fetch-On-Render, Loaders For Render-As-You-Fetch

Vue Query's Suspense guide says Suspense mode works well out of the box as fetch-on-render, and recommends prefetching on routing callbacks and user interactions to move toward render-as-you-fetch [27].

This yields the standard pattern for this skill:

1. Data Loader or interaction warms the Query cache
2. component reads with `await useQuery(...).suspense()` inside async setup
3. Suspense owns the fallback and reveal timing

Do not make Data Loaders and Suspense compete. Loaders should prepare, Suspense should reveal.

## Keep Nested Suspense Boundaries Explicit

Vue's Suspense guide documents that nested async trees sometimes need nested boundaries, and that inner boundaries should use `suspensible` when the parent should remain in control [4].

Use nested Suspense only when the child can legitimately own a second reveal boundary. Otherwise let the parent boundary coordinate the reveal.

## Combine RouterView, Transition, KeepAlive, And Suspense In The Documented Order

Vue's Suspense guide gives an explicit nesting order for `<RouterView>`, `<Transition>`, `<KeepAlive>`, and `<Suspense>` [4]. Follow that order when combining them so navigation, caching, and fallback behavior stay predictable.

## Know The Cancellation Tradeoff

Vue Query's cancellation guide documents the `AbortSignal`-based cancellation mechanism [28], but does not explicitly address how cancellation interacts with the `.suspense()` pattern. Because `await suspense()` blocks setup until the query resolves, mid-flight cancellation is not practical for Suspense-driven reads.

Design around it:

- use Suspense query reads where the route contract and reveal behavior matter more than mid-flight cancellation
- keep long-running, user-cancelable leaf queries on plain `useQuery` without `.suspense()`
- do not promise cancel UX from a Suspense-owned query read
