#!/usr/bin/env node
import process from "node:process";
import { hc } from "hono/client";
import type { AppType } from "@vite-plugin-stickynote/worker/app-type";
import usage from "./usage.md?raw";

type Status = "open" | "resolved";
type LockResult = "done" | "blocked" | "abandoned";

type Thread = {
  id: string;
  status: Status;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
};

type ThreadDetail = {
  thread: Thread;
  comments: Comment[];
};

type ActiveLock = {
  owner: string;
  scope: string;
  branch: string;
  until: string;
  comment_id: string;
  created_at: string;
};

type ParsedArgs = {
  command: string;
  args: string[];
  flags: Map<string, string | true>;
};

type Client = ReturnType<typeof hc<AppType>>;

const LOCK_PREFIX = "[stickynote-lock]";
const UNLOCK_PREFIX = "[stickynote-unlock]";

async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if (
    !parsed.command ||
    parsed.command === "help" ||
    parsed.command === "--help" ||
    parsed.flags.has("help")
  ) {
    printHelp();
    return parsed.command ? 0 : 1;
  }

  if (parsed.command === "usage") {
    console.log(usage.trimEnd());
    return 0;
  }

  const client = createClient();
  switch (parsed.command) {
    case "list": {
      const query: { includeResolved: "true" | "false"; route?: string } = {
        includeResolved: parsed.flags.has("include-resolved") ? "true" : "false",
      };
      const route = getOptionalFlag(parsed, "route");
      if (route) query.route = route;
      const res = await client.api.threads.$get({ query });
      return printJson(await readResponse(res, "GET /api/threads"));
    }
    case "show": {
      const [threadId] = requireArgs(parsed, 1);
      const res = await client.api.threads[":threadId"].$get({ param: { threadId } });
      return printJson(await readResponse(res, `GET /api/threads/${threadId}`));
    }
    case "comment": {
      const [threadId, body] = requireArgs(parsed, 2);
      const res = await client.api.threads[":threadId"].comments.$post({
        param: { threadId },
        json: { body },
      });
      return printJson(await readResponse(res, `POST /api/threads/${threadId}/comments`));
    }
    case "resolve": {
      const [threadId] = requireArgs(parsed, 1);
      return printJson(await setStatus(client, threadId, "resolved"));
    }
    case "reopen": {
      const [threadId] = requireArgs(parsed, 1);
      return printJson(await setStatus(client, threadId, "open"));
    }
    case "locks": {
      const [threadId] = requireArgs(parsed, 1);
      const detail = await loadThread(client, threadId);
      return printJson({ locks: activeLocks(detail.comments, new Date()) });
    }
    case "lock": {
      const [threadId] = requireArgs(parsed, 1);
      const owner = getRequiredFlag(parsed, "owner");
      const scope = getRequiredFlag(parsed, "scope");
      const branch = getRequiredFlag(parsed, "branch");
      const detail = await loadThread(client, threadId);
      const existing = activeLocks(detail.comments, new Date()).filter(
        (lock) => lock.owner !== owner,
      );
      if (existing.length > 0) {
        return printJson({ ok: false, error: "active_lock_exists", locks: existing }, 2);
      }

      const until = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const body = `${LOCK_PREFIX} owner=${owner} scope=${scope} branch=${branch} until=${until}`;
      const commentRes = await client.api.threads[":threadId"].comments.$post({
        param: { threadId },
        json: { body },
      });
      const comment = await readResponse(commentRes, `POST /api/threads/${threadId}/comments`);

      const after = await loadThread(client, threadId);
      const competing = activeLocks(after.comments, new Date()).filter(
        (lock) => lock.owner !== owner,
      );
      if (competing.length > 0) {
        return printJson(
          { ok: false, error: "competing_lock_after_claim", locks: competing, comment },
          2,
        );
      }
      return printJson({ ok: true, lock: body, comment });
    }
    case "unlock": {
      const [threadId] = requireArgs(parsed, 1);
      const owner = getRequiredFlag(parsed, "owner");
      const scope = getRequiredFlag(parsed, "scope");
      const result = getRequiredFlag(parsed, "result");
      if (!isLockResult(result)) {
        throw new CliError("--result must be one of: done, blocked, abandoned");
      }
      const pr = getOptionalFlag(parsed, "pr") ?? "none";
      const body = `${UNLOCK_PREFIX} owner=${owner} scope=${scope} result=${result} pr=${pr}`;
      const res = await client.api.threads[":threadId"].comments.$post({
        param: { threadId },
        json: { body },
      });
      return printJson(await readResponse(res, `POST /api/threads/${threadId}/comments`));
    }
    default:
      throw new CliError(`unknown command: ${parsed.command}`);
  }
}

function createClient() {
  const apiUrl = process.env.STICKYNOTE_API_URL?.replace(/\/+$/, "");
  const token = process.env.STICKYNOTE_TOKEN;
  if (!apiUrl) throw new CliError("STICKYNOTE_API_URL is required");
  if (!token) throw new CliError("STICKYNOTE_TOKEN is required");

  return hc<AppType>(apiUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function setStatus(client: Client, threadId: string, status: Status): Promise<unknown> {
  const res = await client.api.threads[":threadId"].status.$patch({
    param: { threadId },
    json: { status },
  });
  return await readResponse(res, `PATCH /api/threads/${threadId}/status`);
}

async function loadThread(client: Client, threadId: string): Promise<ThreadDetail> {
  const res = await client.api.threads[":threadId"].$get({ param: { threadId } });
  return (await readResponse(res, `GET /api/threads/${threadId}`)) as ThreadDetail;
}

function activeLocks(comments: Comment[], now: Date): ActiveLock[] {
  const locks = new Map<string, ActiveLock>();
  for (const comment of comments) {
    if (comment.body.startsWith(UNLOCK_PREFIX)) {
      const fields = parseFields(comment.body.slice(UNLOCK_PREFIX.length));
      locks.delete(lockKey(fields.owner, fields.scope));
      continue;
    }
    if (!comment.body.startsWith(LOCK_PREFIX)) continue;
    const fields = parseFields(comment.body.slice(LOCK_PREFIX.length));
    if (!fields.owner || !fields.scope || !fields.branch || !fields.until) continue;
    const until = new Date(fields.until);
    if (Number.isNaN(until.valueOf()) || until <= now) continue;
    locks.set(lockKey(fields.owner, fields.scope), {
      owner: fields.owner,
      scope: fields.scope,
      branch: fields.branch,
      until: fields.until,
      comment_id: comment.id,
      created_at: comment.created_at,
    });
  }
  return [...locks.values()];
}

function parseFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of text.trim().split(/\s+/)) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    fields[part.slice(0, index)] = part.slice(index + 1);
  }
  return fields;
}

function lockKey(owner?: string, scope?: string): string {
  return `${owner ?? ""}\u0000${scope ?? ""}`;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const args: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < rest.length; i++) {
    const value = rest[i];
    if (!value) continue;
    if (!value.startsWith("--")) {
      args.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      i++;
    } else {
      flags.set(key, true);
    }
  }
  return { command, args, flags };
}

function requireArgs(parsed: ParsedArgs, count: number): string[] {
  if (parsed.args.length < count) {
    throw new CliError(`${parsed.command} requires ${count} argument(s)`);
  }
  return parsed.args;
}

function getRequiredFlag(parsed: ParsedArgs, name: string): string {
  const value = parsed.flags.get(name);
  if (!value || value === true) throw new CliError(`--${name} is required`);
  return value;
}

function getOptionalFlag(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.flags.get(name);
  return value && value !== true ? value : undefined;
}

function isLockResult(value: string): value is LockResult {
  return value === "done" || value === "blocked" || value === "abandoned";
}

async function readResponse(res: Response, label: string): Promise<unknown> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "error" in data ? String(data.error) : res.statusText;
    throw new CliError(`${label} -> ${res.status}: ${message}`);
  }
  return data;
}

function printJson(data: unknown, code = 0): number {
  console.log(JSON.stringify(data, null, 2));
  return code;
}

function printHelp(): void {
  console.log(`Usage: stickynote <command> [args]

Environment:
  STICKYNOTE_API_URL  Worker origin, without a trailing path
  STICKYNOTE_TOKEN    AI access token or local dev bearer

Commands:
  list [--include-resolved] [--route <route>]
  show <thread-id>
  comment <thread-id> <body>
  resolve <thread-id>
  reopen <thread-id>
  locks <thread-id>
  lock <thread-id> --owner <owner> --scope <scope> --branch <branch>
  unlock <thread-id> --owner <owner> --scope <scope> --result <done|blocked|abandoned> [--pr <url>]
  usage
`);
}

class CliError extends Error {}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    if (error instanceof CliError) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  },
);
