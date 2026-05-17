# Query Options

## Primary Sources

- TanStack Query Vue docs: Query Options [17]
- TanStack Query Vue docs: Reactivity [18]
- TanStack Query Vue docs: Suspense [27]
- TanStack Query Vue docs: Disabling Queries [31]
- TanStack Query Vue docs: Migration to v5 [32]
- TanStack Query Vue docs: TypeScript [24]

## Define Queries In Factory Functions

Define each reusable query in one exported `queryOptions` factory function so `queryKey`, `queryFn`, stale-time policy, and optional `select` stay co-located and type-safe.

```ts
import { queryOptions } from "@tanstack/vue-query";

export const userDetailQuery = (userId: string) =>
  queryOptions({
    queryKey: ["users", "detail", userId],
    queryFn: () => fetchUser(userId),
    staleTime: 30_000,
  });
```

Use the same factory everywhere:

- `queryClient.ensureQueryData(userDetailQuery(userId))`
- `const { data, suspense } = useQuery(userDetailQuery(userId)); await suspense()`
- `queryClient.invalidateQueries({ queryKey: userDetailQuery(userId).queryKey })`

## Structure Query Key Factories Hierarchically

Build a factory object per resource that mixes key-only entries for invalidation with full `queryOptions` entries for fetching. This layered structure lets you invalidate broadly while fetching narrowly.

```ts
import { queryOptions } from "@tanstack/vue-query";
import { toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";

export const postQueries = {
  all: () => ["posts"] as const,
  lists: () => [...postQueries.all(), "list"] as const,
  list: (filters: MaybeRefOrGetter<PostFilters>) =>
    queryOptions({
      queryKey: [...postQueries.lists(), filters],
      queryFn: () => fetchPosts(toValue(filters)),
    }),
  details: () => [...postQueries.all(), "detail"] as const,
  detail: (postId: MaybeRefOrGetter<string>) =>
    queryOptions({
      queryKey: [...postQueries.details(), postId],
      queryFn: () => fetchPost(toValue(postId)),
      staleTime: 30_000,
    }),
};
```

Invalidation examples:

- `queryClient.invalidateQueries({ queryKey: postQueries.all() })` — all post queries
- `queryClient.invalidateQueries({ queryKey: postQueries.lists() })` — all list variations
- `queryClient.invalidateQueries({ queryKey: postQueries.detail(postId).queryKey })` — one detail

## Design Query Keys Deliberately

Build keys from stable domain segments, not ad hoc strings. Prefer this shape:

- resource family
- operation or scope
- route params
- search-derived filters

Examples:

- `['posts', 'list', filters]`
- `['posts', 'detail', postId]`

Do not:

- reuse the same key for list and detail data
- hide query inputs in closures that are not reflected in the key
- invent helper wrappers that obscure the final key shape

## Keep Vue Reactivity Inside The Query Key

Vue Query tracks refs and reactive getters in query keys and options [18]. Make query factory functions accept `MaybeRefOrGetter<T>` when the same query must work in loaders and components.

```ts
export const userDetailQuery = (userId: MaybeRefOrGetter<string>) =>
  queryOptions({
    queryKey: ["users", "detail", userId],
    queryFn: () => fetchUser(toValue(userId)),
  });
```

The key Vue-specific rule is:

- put the ref or getter itself in `queryKey`
- unwrap with `toValue()` only inside `queryFn` or other non-key options
- remember that `queryKey` and `enabled` are the two query options that accept reactive values [18]

That preserves reactivity. If the route param or prop changes, Vue Query sees the key change and updates correctly.

## Spread `queryOptions` At Usage Sites

A `queryOptions` factory defines the base configuration. At usage sites, spread the factory result and layer on additional options as needed.

```ts
// In a Data Loader
await queryClient.ensureQueryData(postQueries.detail(to.params.postId));

// In an async setup component inside a Suspense boundary
const { data: post, suspense } = useQuery({
  ...postQueries.detail(() => route.params.postId),
  select: (data) => data.title,
});
await suspense();

// In a non-Suspense leaf widget
const comments = useQuery({
  ...commentQueries.list(() => route.params.postId),
  enabled: () => route.query.tab === "comments",
});
```

This pattern is why custom composables are often unnecessary. A `queryOptions` factory works everywhere: in Data Loaders, event handlers, and components. Vue Query composables can also run in other valid injection contexts in v5 [32], but they are still a worse reuse unit for shared query definitions than a plain factory.

## Use Plain `useQuery` For Conditional Reads

In Vue Query, use plain `useQuery` when conditional execution is mandatory or when the component intentionally owns a non-Suspense branch.

### `enabled` — flexible disabling with manual refetch

Prefer `enabled` for route-driven UI branches and cases where `refetch()` must remain available. `enabled` accepts reactive values (Ref, Computed, getter) [18].

```ts
useQuery({
  ...userDetailQuery(() => route.params.userId),
  enabled: () => route.query.panel === "profile",
});
```

### `skipToken` — type-safe disabling via `queryFn`

Use `skipToken` when the primary goal is type-safe argument narrowing [31]. Pass it as the `queryFn` value, not as an option on `enabled`.

```ts
import { useQuery, skipToken } from "@tanstack/vue-query";

const queryFn = computed(() => (userId.value ? () => fetchUser(userId.value) : skipToken));

const { data } = useQuery({
  queryKey: ["users", "detail", userId],
  queryFn: queryFn,
});
```

Key constraints:

- `skipToken` goes in `queryFn`, not `enabled` [31]
- `refetch()` throws `Missing queryFn` when `skipToken` is active — use `enabled` if manual refetch is needed [31]
- in Vue, the conditional `queryFn` must be wrapped in `computed()` because a bare Ref is always truthy [31]
- do not combine `skipToken` and `enabled` on the same query — they are not designed to work together
- `skipToken` cannot be used with Suspense reads (`await suspense()`) because there is no valid `queryFn` to resolve

### When to choose which

| Scenario                                                 | Recommended                                        |
| -------------------------------------------------------- | -------------------------------------------------- |
| Route-driven conditional UI branches                     | `enabled` (reactive getter)                        |
| Type-safe argument narrowing in `queryOptions` factories | `skipToken`                                        |
| Manual `refetch()` required                              | `enabled`                                          |
| Suspense read path                                       | Neither — Suspense reads should not be conditional |

Do not bend a Suspense boundary into handling every conditional leaf widget. Use the stricter path where it improves the route contract.

## Default To Suspense Reads

When the page contract is route-critical, use Data Loader prefetching plus Suspense reads as the standard path [19][27].

The official Suspense pattern in Vue Query is `useQuery(...).suspense()` inside async `setup()` [27]. The component's `setup` must be `async` and wrapped in a `<Suspense>` boundary.

Vue Query's Suspense guide explicitly recommends prefetching on routing callbacks and user interactions to move from fetch-on-render toward render-as-you-fetch [27].

Allow plain `useQuery` only when one of the skill-level exceptions applies:

- conditional execution is mandatory
- `placeholderData` is required for the UX
- a legacy surface cannot be migrated to Suspense yet

## Use `select` To Shape Consumer Data, Not To Hide Ownership

Use `select` when multiple consumers need different projections of the same cached result. Keep it pure and cheap. If the transform is expensive or widely reused, move it next to the query factory as a named helper.

Do not use `select` to compensate for a bad key design or to merge unrelated resources into one query.

## Check Status By Data Availability First

When rendering plain `useQuery` results, check for data presence before error status. If stale data exists from a previous successful fetch, prefer showing it over an error screen.

## Do Not Mutate Query Results Directly

Vue Query result data should be treated as read-only [18]. Do not pass query data directly into `v-model` or mutate it in place. If the UI needs a writable draft, create a local copy and keep the server-owned value in Query.

## Be Careful With Abstractions

Prefer exporting query factories over exporting custom query composables. Add a custom composable only when it fixes a real UI contract, for example:

- combine a query with route-derived inputs
- pair a query with a reload or reset behavior
- return a domain-specific command surface, not raw Query options

Do not create wrappers that only rename a `useQuery(someQuery(args)).suspense()` call.

## Let TypeScript Infer

Do not pass explicit generics to `useQuery` or `useMutation`. Type the `queryFn` return value instead and let inference flow through `queryOptions`.
