# Mutations And Optimistic UI

## Primary Sources

- TanStack Query Vue docs: mutations [22]
- TanStack Query Vue docs: query invalidation [20]
- TanStack Query Vue docs: invalidations from mutations [21]
- TanStack Query Vue docs: optimistic updates [23]
- Vue Router docs: Reloading data [14]

## Keep Server State In Query

Use mutations to change server state, then reconcile TanStack Query cache. Prefer invalidation as the default reconciliation strategy because it preserves a clear ownership model and guarantees fresh server data [20][21].

Reach for direct cache writes only when:

- the mutation response already contains the complete authoritative entity
- the optimistic update and rollback plan are explicit
- the affected cache scope is well understood

When in doubt, invalidate. Direct cache updates are an optimization, not the default.

## Prefer `mutate` Over `mutateAsync`

Use `mutate` by default. Use `mutateAsync` only when you genuinely need to `await` the result to sequence a follow-up step such as navigation, dialog closure, or a second mutation.

## Use UI-Level Optimistic Updates For Single-Surface Cases

Vue Query documents two optimistic strategies: via the UI and via the cache [23]. Use UI-level optimistic rendering when the optimistic state only needs to appear in one place.

This is the simpler variant because it does not require cache rollback machinery.

## Use `onMutate` For Shared Optimistic State

When multiple parts of the screen need to see the optimistic state, update through the cache.

TanStack Query's optimistic-updates guide explicitly recommends canceling outgoing refetches, snapshotting previous data, and rolling back on error [23].

## Model Concurrent Updates Explicitly

Assume multiple writes can overlap [23]. Vue Query's optimistic-updates guide explicitly notes that multiple pending mutations may exist at once and that mutation state helpers can be used to display concurrent optimistic state [23].

Avoid a single page-level `isSaving` boolean when multiple rows, cards, or controls can mutate independently.

## Invalidate Smartly After Overlapping Writes

When multiple mutations can overlap, model that concurrency directly. Use mutation state helpers to show row-level or card-level pending state, and prefer invalidation scopes that match the resource family instead of manually refetching one query at a time. This keeps overlapping writes coherent even when optimistic state is present [23].

## Separate Mutation Success From Navigation

Do not bury navigation in ad hoc callback chains. Decide whether navigation is part of the mutation contract or a caller concern. If navigation follows an awaited mutation, make that sequencing explicit at the call site.

## Reload Router Loaders Only When Route State Changed

After a mutation that changes route validity or a loader-owned derived summary, call the loader's `reload()` to recompute the route contract [14]. For ordinary Query-backed entity updates, prefer Query invalidation first.

## Protect Read Consistency

Do not mirror server entities into long-lived local state just to make forms or optimistic UI easier. Keep local draft state narrow and re-sync from Query when the mutation lifecycle completes.
