# Testing

## Primary Sources

- TanStack Query Vue docs: Testing [25]
- TanStack Query Vue docs: Installation [29]
- Vue Router docs: Data Loaders and routing guides [10][11]
- Vue docs: Suspense [4]

## Create A Fresh QueryClient Per Test

Build a test helper that creates a new `QueryClient` for each test. Shared clients leak cache state and mutation state across tests.

Disable retries by default in tests unless the test is explicitly about retry behavior.

## Use `setQueryDefaults` For Test Overrides

Prefer targeted query defaults in tests over changing production query definitions. This keeps tests focused on behavior instead of implementation details.

## Render Router, Suspense, And Query Together

Test route behavior with the same app setup production uses:

- a fresh `QueryClient` wired through `VueQueryPlugin` [29]
- `DataLoaderPlugin` installed before `router` [11]
- the app-mounted `router`
- the Suspense boundaries that own the page contract

Do not test route components in isolation when the behavior depends on loaders, params, query-string contracts, or Suspense ownership.

In Vue, this is a plugin-install problem, not a provider-stack problem. Recreate the production mounting model in the test helper instead of inventing a test-only composition root.

## Prefer MSW For Network Control

Mock the network boundary, not query composables. Prefer MSW so loader prefetching, Suspense reads, retries, and mutation invalidation all exercise the real client-side control flow.

## Test What This Skill Cares About

Cover these cases:

- route loader preloads route-critical data before the route content reveals
- query-string state drives the correct query key and survives navigation
- typed navigation updates the URL and preserves intended state
- Suspense boundaries keep the right UI revealed during async route changes
- mutation success invalidates or reconciles the right queries
- background errors do not blank already revealed stale content
- catch-all and route-local not-found paths render the expected fallback

## Keep Async Assertions User-Facing

Assert on visible outcomes and navigation state, not on implementation details like "composable X was called". This stack is intentionally declarative; tests should verify the contract the user sees.
