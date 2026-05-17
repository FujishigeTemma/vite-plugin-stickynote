# Experimental Features

## Primary Sources

- Vue docs: `<Suspense>` [4]
- TanStack Query Vue docs: Suspense [27]
- Vue Router docs: Data Loaders under `vue-router/experimental` [5][10][11]

## Keep Experimental Async Primitives Deliberate

This skill intentionally standardizes on Vue Suspense and Router Data Loaders even though both sit on experimental footing:

- Vue docs mark `<Suspense>` as experimental [4]
- TanStack Query Vue docs mark Suspense mode as experimental and recommend patch-level version pinning [27]
- Vue Router ships Data Loaders from `vue-router/experimental` [5]

Treat that as a real engineering constraint, not a footnote.

## Require An Opt-In Checklist

Before leaning on Suspense-native routing patterns, confirm all of the following:

- the app intentionally accepts experimental async primitives
- Vue and Vue Query versions are pinned tightly enough to avoid accidental compatibility drift [27]
- the UX still works with plain `useQuery` and explicit loading branches if Suspense must be backed out
- the route contract is still coherent if a loader becomes lazy or a Suspense boundary is removed

## Keep The Rollback Cheap

Design experimental usage so removal is mechanical:

- isolate route-critical Suspense boundaries near route edges
- keep query factories reusable from both Suspense and non-Suspense reads
- avoid making business logic depend on a specific experimental primitive
- keep a plain `useQuery` fallback path possible for leaf widgets and incremental rollback

If a task does not satisfy the checklist, stay conservative even within this skill: keep Query ownership, keep loaders narrow, and reduce the number of experimental boundaries involved.
