# Principles

## Primary Sources

- Vue docs: `<Suspense>` [4], `<script setup>` [1]
- Vue Router docs: File-Based Routing [6], Data Loaders [11], Composition API [9]
- TanStack Query Vue docs: overview [16], Suspense [27]

## Use Suspense-Native Vue As The Baseline

Assume reads and writes are asynchronous even when the happy path is fast. Design UI so fast responses feel synchronous and slow responses stay coherent instead of flashing unrelated spinners or clearing revealed content.

Treat these layers as separate systems with separate owners:

- URL state: path params and query string that must survive refresh, share, back/forward, and new-tab opens
- Route state: navigation lifecycle, redirects, not-found behavior, blocking vs lazy loader decisions, and route boundaries
- Loader state: route-scoped async orchestration for what must resolve before or during navigation [10][11]
- Cache state: fetched server data and its freshness rules
- Local state: transient interaction details that do not belong in the URL or cache

## Pick One Source Of Truth Per Concern

Use this table when deciding where state belongs:

| Concern                                                                  | Owner                 | Notes                                                          |
| ------------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------- |
| Entity data from the server                                              | TanStack Query cache  | Treat Query as authoritative server state [16][20]             |
| Whether the navigation can enter a page                                  | Router + Data Loader  | Redirect, reroute, or error before revealing the page [10][11] |
| Which resource the page is showing                                       | Path params           | Do not mirror the same identifier in component state           |
| Filters, pagination, sort, tab-like navigation that should persist/share | Query string          | Validate and normalize at the route boundary                   |
| Temporary form draft or popover visibility                               | Local component state | Keep local unless it must survive navigation                   |

If two places can answer the same question, remove one. Duplicate ownership causes stale UI and inconsistent navigation behavior.

## Distinguish Boundary And Leaf Components

Components fall into two roles:

**Boundary Components** sit at route or Suspense boundaries. They own data fetching (Data Loaders, Suspense-mode query reads via `await useQuery(...).suspense()`), route params, query-string contracts, and async setup. This is the contract surface — what comes in and what is provided to children is explicit here.

**Leaf Components** live below boundaries. They receive data via props or provide/inject and own only local ephemeral state (form input, accordion open/close, hover). They do not fetch route-critical data or read route params directly unless they are intentionally route-aware shared components.

Design starts at the boundary: decide what data the route needs, fetch it there, then pass it down. Do not scatter Suspense query reads across deeply nested leaves for route-critical data.

## Follow The Data Flow

```
URL (Vue Router path params / query string)
  ↓
Data Loader (prefetch into TanStack Query cache)
  ↓
Boundary Component (useData / await useQuery().suspense() + Suspense boundary)
  ↓ props
Leaf Component (local ephemeral state + UI)
  ↓ user action
Mutation (useMutation → invalidateQueries)
  ↓
TanStack Query cache update → re-render
```

If state does not fit this flow, ask whether it belongs in the URL, in the cache, or genuinely needs to be local. Reaching for Pinia or a global store should be the last resort, not the first.

## Lift State Bottom-Up

Start with state inside the component. Only lift when a concrete need appears — a sibling needs the same value, or the state must survive navigation. The default is local; the exception is shared.

Before lifting into a global store, check whether the state can live in the URL (query string) or in the Query cache (server-derived). Most "global" state turns out to be one of those two.

## Treat Composables As UI Logic Separation, Not Stores

A `useXxx` composable extracts component logic for readability. Its state lifecycle is still bound to the component that calls it. Do not treat composables as singleton stores or shared state containers — that role belongs to TanStack Query (server state) or the URL (navigable state).

## Enforce Responsibility Boundaries

Apply these rules:

- Put server data in Query, not in Pinia or duplicated local state.
- Put route-critical fetching in Data Loaders and Query prefetching, not in `onMounted()` [10][11][19].
- Put Suspense boundaries around the content that can legitimately wait [4][27].
- Put shareable state in the URL, not in hidden component state [9].

Reject these anti-patterns:

- Fetching route-critical data after render in a page component
- Storing `route.query.page` in both the URL and a local ref
- Treating loader return data as the only server-state owner when the same resource is already Query-backed
- Using watchers to orchestrate navigation or refetches that belong to the router or query layer

## Optimize For Consistent UX

Keep the app shell revealed while new content loads. Prefer:

1. Immediate pending feedback on the control the user touched
2. Stable surrounding layout
3. Suspense fallback only inside the content area that is actually changing [4]
4. Final content reveal without clearing the whole screen

Vue's Suspense guide explicitly documents that once a boundary is resolved, it only re-enters pending when the root node of the default slot is replaced, and it can keep the previous default content visible while waiting on the new one [4]. Design around that behavior instead of fighting it with page-wide loading flags.
