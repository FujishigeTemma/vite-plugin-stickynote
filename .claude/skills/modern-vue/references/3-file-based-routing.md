# File-Based Routing

## Primary Sources

- Vue Router docs: File-Based Routing [6]
- Vue Router docs: Typed Routes [7]
- Vue Router docs: Composition API [9]
- Vue Router docs: Extending Routes [15]

## Standardize On File Routes

Use Vue Router v5 file-based routing as the default [5][6]. Create one route file per URL boundary and keep route-level concerns at the route boundary:

- query-string contracts
- Data Loader exports
- static route metadata
- aliases
- auth flags in `meta`

Do not default to code-based routing examples.

## Know The File Naming Conventions

Vue Router uses specific file naming patterns [6]:

- `(group).vue` — route group for organization without affecting the URL
- `[userId].vue` — dynamic params
- `[[slug]].vue` — optional params
- `[id]+.vue` — repeatable params
- `[...path].vue` — catch-all / not-found
- `users.vue` — nested layout for `users/`
- `users.edit.vue` — break nesting while keeping the URL shape

Keep file names boring and predictable. The route tree should mirror product navigation, not component nesting accidents.

## Treat URL State As A Product Contract

Use path params for resource identity and structural navigation. Use query string for shareable page state such as filters, pagination, and sort.

Vue Router's Composition API guide explicitly recommends avoiding watches on the whole route object and instead watching the specific properties you expect to change [9]. In this stack, prefer passing those route properties into query factories or Data Loaders so the URL remains the source of truth.

Do not keep the same filter, page, or sort state in both the URL and local state.

## Use Typed Navigation

Prefer generated route names and typed helpers over stringly navigation [7]. The v5 migration guide recommends the generated type file in `src/route-map.d.ts` [5].

Prefer:

```ts
router.push({ name: "/users/[userId]", params: { userId } });
```

Over:

```ts
router.push(`/users/${userId}`);
```

This keeps route changes refactor-safe and avoids hand-built string URLs.

## Use Shared Composables Carefully

Inside route-owned components, prefer typed route composables such as `useRoute('/users/[userId]')`. In reusable leaf components, prefer passing route-derived values as props so the component is not coupled to one URL shape [9]. Use generic `useRoute()` only in shared components that are intentionally route-aware. Treat that as an escape hatch, not the default.

## Understand Reactive Route Reads

The `route` object is reactive, but Vue Router recommends against watching the whole object [9]. Prefer:

- route-specific typed params
- getters like `() => route.params.userId`
- query factories that accept refs or getters

Avoid creating an extra layer of watchers just to mirror route changes into local refs.

## Use `definePage()` Correctly

Use `definePage()` for static route metadata and route object overrides that can be extracted at build time [15]:

```vue
<script setup lang="ts">
definePage({
  meta: {
    requiresAuth: true,
  },
  alias: ["/members/:userId"],
});
</script>
```

Do not use variables inside `definePage()`. Vue Router documents that the macro is extracted at build time and removed from `<script setup>` [15]. Do not try to put `beforeEnter` there either; use route meta plus a global guard instead [15].

## Co-locate By Route, Not By File Type

Organize files by the route they belong to, not by category (all components in one folder, all composables in another). Route-level co-location keeps related code close and makes it obvious what belongs to what.

Use the `exclude` option (picomatch globs) to prevent co-located component directories from becoming routes:

```ts
// vite.config.ts
import VueRouter from "unplugin-vue-router/vite";

export default defineConfig({
  plugins: [
    VueRouter({
      exclude: ["**/components/**", "**/composables/**"],
    }),
    // ...
  ],
});
```

Then co-locate freely:

```
src/pages/
├── (auth)/
│   ├── dashboard/
│   │   ├── index.vue            # /dashboard boundary component
│   │   ├── components/          # excluded from route generation
│   │   │   ├── DashboardHeader.vue
│   │   │   └── StatsCard.vue
│   │   └── composables/
│   │       └── useStatsAnimation.ts
│   └── posts/
│       ├── index.vue
│       ├── [postId].vue
│       └── components/
│           └── PostEditor.vue
```

Place shared code outside the route tree:

```
src/
├── components/                # UI used across multiple routes
│   ├── ui/                    # generic primitives (Button, Input)
│   └── shared/                # domain-shared (UserAvatar)
├── queries/                   # queryOptions factories by domain
├── api/                       # fetcher functions
├── composables/               # composables used across multiple routes
├── stores/                    # truly global state (auth, theme) — keep minimal
└── lib/                       # utilities, queryClient, router config
```

The decision boundary is simple: if a component, composable, or query is used only within one route, co-locate it under that route's directory. If it is used across routes, promote it to the shared location.

## Keep File Structure Predictable

Use a route tree that mirrors product navigation, not component nesting accidents [6]. Keep route file names and folders boring and obvious so loaders, params, and errors remain easy to locate during debugging and review.
