import { type TypeID, typeid } from "typeid-js";

export function newThreadId(): TypeID<"thread"> {
  return typeid("thread");
}

export function newCommentId(): TypeID<"comment"> {
  return typeid("comment");
}

export function newComponentId(): TypeID<"component"> {
  return typeid("component");
}

export function nowISO(): string {
  return new Date().toISOString();
}
