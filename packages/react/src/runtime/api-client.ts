import { hc } from "hono/client";
import type { AppType } from "@vite-plugin-stickynote/worker/app-type";
import { getAuthSource } from "./auth-source.ts";

export type Client = ReturnType<typeof hc<AppType>>;

let client: Client | null = null;

export function initAPIClient(baseUrl: string, devBearer: string | null): void {
  client = hc<AppType>(baseUrl, {
    headers: async (): Promise<Record<string, string>> => {
      const source = getAuthSource();
      const token = source ? await Promise.resolve(source()) : devBearer;
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
