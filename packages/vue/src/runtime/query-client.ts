import { MutationCache, QueryCache, QueryClient } from "@tanstack/vue-query";

const onError = (err: unknown, label: string): void => {
  console.error(`[stickynote] ${label}`, err);
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err, query) => onError(err, `query ${JSON.stringify(query.queryKey)}`),
  }),
  mutationCache: new MutationCache({
    onError: (err) => onError(err, "mutation"),
  }),
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});
