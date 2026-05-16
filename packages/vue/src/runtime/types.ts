import { type InferRequestType, type InferResponseType, hc } from "hono/client";
import type { AppType } from "stickynote-worker/app-type";

type Client = ReturnType<typeof hc<AppType>>;

export type Thread = InferResponseType<Client["api"]["threads"]["$get"], 200>["threads"][number];

export type Comment = InferResponseType<
  Client["api"]["threads"][":id"]["comments"]["$get"],
  200
>["comments"][number];

export type CreateThreadInput = InferRequestType<Client["api"]["threads"]["$post"]>["json"];
