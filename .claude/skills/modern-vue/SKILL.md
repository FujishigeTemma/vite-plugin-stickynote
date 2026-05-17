---
name: modern-vue
description: Opinionated guidance for building and refactoring Vue 3.5 TypeScript SPAs that use Vue Router v5 built-in file-based routing, Router Data Loaders, Vue Suspense, and TanStack Query Vue v5. Use when Codex needs to implement or review data fetching, mutations, navigation, URL query params, route data loaders, Suspense, async setup, optimistic UI, error handling, or testing in a non-SSR CSR app and must enforce consistent async UI contracts instead of offering multiple styles.
---

# Modern Vue

## Core Position

Build Vue 3.5 apps around Suspense-native rendering [4][27] instead of ad hoc loading flags. Treat Vue Router and Router Data Loaders as the navigation and route-loading coordinator, TanStack Query as the source of truth for server state [16][20], and the URL as the source of truth for navigable state.

Optimize for the same user input producing the same UX shape across the app. Prefer one strong pattern over a menu of options.

## Scope

Stay in scope:

- Use Vue 3.5+ Composition API components in a non-SSR SPA/CSR setup [1].
- Use TanStack Query Vue v5 for server state.
- Use Vue Router v5 built-in file-based routing.
- Use Router Data Loaders from `vue-router/experimental`.
- Use TypeScript.

Stay out of scope unless the user explicitly overrides this skill:

- Do not design for Nuxt, SSR, SSG, hydration, or streaming.
- Do not use Options API examples as the default path.
- Do not default to code-based route definitions.
- Do not use Pinia or other app stores for fetched server entities by default.
- Do not treat ad hoc `isLoading` branches as the standard read path.

## Golden Rules

1. Centralize every reusable query definition in a `queryOptions` factory function [17].
2. Standardize on Vue Router file-based routing [5][6].
3. Build read paths Suspense-first [4][27].
4. Preload route-critical data in Router Data Loaders [10][11][19]; do not create component-fetch waterfalls.
5. Treat Vue Router and Data Loaders as the coordinator for navigation and loading, and TanStack Query cache as the source of truth for server state [10][16][20].
6. Keep reactive inputs reactive all the way into the `queryKey`: pass refs or reactive getters into query factory functions, and only unwrap inside `queryFn` with `toValue()` [18].
7. Use async `setup()` or top-level `await` only inside explicit Suspense boundaries [1][4][27].
8. Prefer invalidation after mutations and use optimistic updates only with an explicit rollback plan [21][23].
9. Keep path params and query string as the source of truth for URL state [6][9]; do not mirror the same meaning in local state.
10. Use route meta, Data Loaders, and injected dependencies for route orchestration [8][10][15]; do not move navigation logic into watchers.
11. Standardize error handling around Data Loader errors, Suspense error capture, and non-destructive background refetch handling [4][13][26].
12. Because Vue Suspense and Vue Query Suspense remain experimental, pin compatible versions and keep a non-Suspense fallback plan [4][27].

## Allowed Exceptions

- Allow `useQuery` only for incremental migration where Suspense boundaries cannot be added yet, when `enabled` or `skipToken` is required, or when `placeholderData` is a hard UX requirement.
- Allow route components to fetch non-critical leaf-widget data directly only when skipping preload does not degrade the page contract.
- Allow a Data Loader to return non-Query data directly when the route contract is inherently router-owned, such as reroutes, ACL checks, or navigation-dependent derived data.
- Allow local non-Suspense loading branches only for isolated widgets or incremental migration where the route contract is already coherent.
- Allow custom composables only when they compose query, mutation, Suspense, and router behavior into a stable UI contract; do not add thin naming wrappers.

## Reference Map

- Read [references/1-principles.md](./references/1-principles.md) when deciding ownership between URL state, route state, loader state, cache state, and local UI state.
- Read [references/2-query-options.md](./references/2-query-options.md) when defining queries, keys, `select`, Suspense usage, Vue reactivity, and query abstractions.
- Read [references/3-file-based-routing.md](./references/3-file-based-routing.md) when creating routes, params, query-string contracts, `definePage()`, and typed navigation.
- Read [references/4-router-loading-preloading.md](./references/4-router-loading-preloading.md) when wiring Data Loaders, preloading, Query integration, and cache coordination.
- Read [references/5-suspense-transitions.md](./references/5-suspense-transitions.md) when placing Suspense boundaries, preserving revealed UI, using async setup, or combining RouterView with Suspense.
- Read [references/6-mutations-optimistic.md](./references/6-mutations-optimistic.md) when implementing writes, invalidation, optimistic updates, or post-mutation navigation.
- Read [references/7-errors-boundaries-not-found.md](./references/7-errors-boundaries-not-found.md) when routing errors, expected loader errors, catch-all not-found paths, background refetch failures, or error capture are involved.
- Read [references/8-testing.md](./references/8-testing.md) when testing QueryClient, Router, Data Loaders, Suspense, navigation, or async behavior.
- Read [references/9-experimental-features.md](./references/9-experimental-features.md) when validating version pinning, fallback plans, or release-risk decisions for Suspense or Data Loaders.
- See [references/LINKS.md](./references/LINKS.md) for the numbered citation index used throughout these references.

## Working Style

Apply this sequence:

1. Confirm the task fits the scope. If not, say so and narrow the recommendation.
2. Decide the source of truth for each stateful concern before writing components.
3. Define route files and route boundaries before component details.
4. Define `queryOptions` factory functions before calling query hooks.
5. Wire route-critical Data Loader preloading for route-critical reads.
6. Add Suspense boundaries and async-setup pending behavior.
7. Add mutations, invalidation, and optimistic UI only after the read path is coherent.
8. Add error handling, not-found handling, and tests before calling the implementation done.

## Output Requirements

- Be decisive. Do not present multiple equally valid architectures unless the user asked for tradeoffs.
- Name anti-patterns directly and replace them with the preferred pattern.
- Keep examples aligned with Vue Router file-based routing, Router Data Loaders, Vue Suspense, and TanStack Query Vue v5 APIs.
- Preserve consistent terminology: URL state, route state, loader state, cache state, local state, route-critical data, leaf widget, Suspense boundary, async setup, blocking loader, lazy loader.
- Keep Vue examples on Composition API and `<script setup lang="ts">` unless the task explicitly needs another form.
