// Public plugin options: what the consumer passes to `stickynote(...)`.
export type StickynoteOptions = {
  // Worker base URL, e.g. "http://localhost:8787". No trailing slash.
  apiUrl: string;
  // GitHub repo in "owner/name" form, used to build deep links to source.
  // Optional; if absent the overlay omits source links.
  githubRepo?: string;
  // For local dev only. When the worker is in "dev" issuer mode, this static
  // bearer is sent as Authorization. Never set this in production builds.
  devBearer?: string;
};

// Runtime options injected into the overlay. Keep in sync with what
// the plugin emits in transformIndexHtml so the runtime can stay typed.
export type OverlayOptions = {
  apiUrl: string;
  githubRepo: string | null;
  commitHash: string;
  dirtyBuild: boolean;
  devBearer: string | null;
};
