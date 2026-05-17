import { hc } from "hono/client";
import type { AppType } from "@vite-plugin-stickynote/worker/app-type";

export type Client = ReturnType<typeof hc<AppType>>;
export type AuthSource = () => string | Promise<string | null> | null;

let client: Client | null = null;

export function initAPIClient(baseUrl: string, getToken: AuthSource): void {
  client = hc<AppType>(baseUrl, {
    headers: async (): Promise<Record<string, string>> => {
      const token = await Promise.resolve(getToken());
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });
}

export function getAPIClient(): Client {
  if (!client) throw new Error("[stickynote] api client not initialized");
  return client;
}

export function clearAPIClient(): void {
  client = null;
}
