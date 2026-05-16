import { type TypeID, typeid } from "typeid-js";

export function newThreadId(): TypeID<"thread"> {
  return typeid("thread");
}

export function newCommentId(): TypeID<"comment"> {
  return typeid("comment");
}

export function nowISO(): string {
  return new Date().toISOString();
}
