# Router Loading And Preloading

## Primary Sources

- Vue Router docs: Data Loaders [10][11][12]
- Vue Router docs: Reloading data [14]
- Vue Router docs: Navigation Guards [8]
- TanStack Query Vue docs: Prefetching [19]
- TanStack Query Vue docs: Suspense [27]

## Give Loaders A Narrow Job

Use Router Data Loaders to prepare route-critical data before the route commits [10][11]. A loader may:

- ensure critical Query data is in cache
- reroute or fail fast
- derive dependencies from `to`, route meta, and injected services

A loader should not:

- create `watch`, `computed`, or `ref` state inside the loader [10]
- duplicate data ownership that belongs to Query
- fetch every secondary widget that could load later without harming the route contract

## Declare Loader Dependencies From `to`

Vue Router's defining-loaders guide explicitly says the `to` argument is the source of truth for all data fetching parameters [10]. Treat that as the Vue equivalent of explicit loader dependencies: if params, query string, or route state affect the loader, derive them from `to` and nowhere else.

## Integrate Query Through `ensureQueryData`

When TanStack Query owns server state, use the loader to warm the cache:

```ts
export const usePostLoader = defineBasicLoader("/posts/[postId]", async (to) => {
  await queryClient.ensureQueryData(postQueries.detail(to.params.postId));
});
```

Then read the same query in the component with `await useQuery(...).suspense()` inside async setup. This preserves one server-state owner while avoiding component-fetch waterfalls.

## Use Injected Dependencies Before `await`

Vue Router explicitly documents that `inject()` and stores can be used inside loader functions, but only before the first `await` [10]. Treat this as the dependency-injection boundary for loaders.

Use route meta plus guards for cross-cutting checks. Use loaders for route-critical data preparation.

## Configure Pending UI Timing

Vue Router does not provide the exact pending timing knobs that TanStack Router does. In this stack, you control pending timing with three levers:

- blocking vs `lazy` Data Loaders [10]
- Suspense boundary placement and `timeout` [4]
- whether Query data is prefetched before mount [19][27]

Use these deliberately so pending UX is stable instead of accidental.

## Choose The Right Preload Strategy

Use preloading in two places:

- routing callbacks and Data Loaders for route-critical data [10][11]
- user interactions such as hover or intent signals to start Query prefetch earlier [19][27]

Vue Query's Suspense guide explicitly recommends prefetching on routing callbacks and user interaction events to move from fetch-on-render toward render-as-you-fetch [27].

## Coordinate Router Preload And Query Freshness

Keep one freshness policy. If Query owns freshness, loaders should seed or refresh Query, not invent a second long-lived freshness system that disagrees with it.

Use:

- Query `staleTime` for freshness
- Data Loaders for navigation-aware orchestration
- Suspense for rendering orchestration

Do not let loader-local data become a second cache with different semantics.

## Keep Loader Exports Obvious

Vue Router connects loaders to page routes through exported composables and route names [10][12]. Keep one obvious loader export per page-level concern, and keep route-critical loader wiring close to the page that owns it.

## Understand Code Splitting Boundaries

Vue's Suspense guide explicitly notes that Vue Router's lazily loaded route components are distinct from async components and currently do not trigger Suspense by themselves [4]. A route-level dynamic import is not enough; the component tree still needs an async dependency such as async setup or a Suspense-enabled query read to suspend.

## Defer Non-Critical Data

For data that is not route-critical, use one of two deferred-loading patterns:

1. block the route only for the page contract, then fetch the secondary widget inside a nested Suspense boundary
2. fire a `prefetchQuery` in the loader and read it later in a nested Suspense boundary

Prefer the second pattern when Query owns the data, as it integrates naturally with Query cache and refetching.

## Avoid Over-Preloading

Preload what the next route needs to feel immediate. Do not eagerly load every possible leaf widget. If data is not route-critical, keep it out of the blocking loader and let a nested Suspense boundary or leaf query handle it.

## Reload Only When Loader State Matters

Use loader `reload()` when the current route contract itself must be recomputed, for example:

- a mutation changes data that determines whether the current page is still valid
- expected loader errors should be retried from the route level
- a route-level derived summary must be recomputed

For ordinary Query-backed entity updates, prefer Query invalidation first. If the page renders from `useQuery`, invalidation keeps the UI live without forcing route orchestration to rerun.

Vue Router's reload docs explicitly note that reloads do not involve navigation guards, and navigation results returned by loaders are ignored during reload [14]. Do not use `reload()` as a hidden substitute for navigation.
