import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-oxc";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import stickynote from "@vite-plugin-stickynote/react";

export default defineConfig(({ mode }) => ({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts",
      autoCodeSplitting: true,
    }),
    react(),
    // The plugin's built-in `apply` only skips Vite's default production
    // build (`vite build` with no `--mode`). For any other mode label
    // (e.g. `prod`, `release`) the consumer must gate the plugin here,
    // otherwise the overlay ships in the bundle.
    mode !== "prod" &&
      stickynote({
        apiUrl: "http://localhost:8787",
        githubRepo: "FujishigeTemma/vite-plugin-stickynote",
        // Local-dev only. Matches DEV_BEARER in packages/worker/.dev.vars.
        devBearer: "stickynote-dev-token",
      }),
  ],
  server: {
    // The plugin resolves through a pnpm workspace symlink, and Vite's
    // watcher skips node_modules by default. Un-ignore the linked package
    // so edits to its runtime sources (served via virtual modules)
    // trigger HMR.
    watch: {
      ignored: ["!**/node_modules/@vite-plugin-stickynote/react/**"],
    },
  },
}));
