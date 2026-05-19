import type { InferRequestType, InferResponseType } from "hono/client";
import type { Client } from "./api-client.ts";

export type Thread = InferResponseType<Client["api"]["threads"]["$get"], 200>["threads"][number];

export type Component = Thread["components"][number];

export type Comment = InferResponseType<
  Client["api"]["threads"][":threadId"]["comments"]["$get"],
  200
>["comments"][number];

export type CreateThreadInput = InferRequestType<Client["api"]["threads"]["$post"]>["json"];

export type Me = { sub: string; name: string };
