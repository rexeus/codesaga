// An MCP client for journeys: drives the real `codesaga mcp` command in-process over a fake stdin and stdout.
import { NodeServices } from "@effect/platform-node";
import {
  ConfigProvider,
  Effect,
  Layer,
  Queue,
  Schema,
  Sink,
  Stdio,
  Stream,
} from "effect";
import type { Cause, Scope } from "effect";

import { runCli } from "../cli.js";
import { oxcParserLayer } from "../typescript/oxc-parser.js";
import { WorkingDirectory } from "../working-directory.js";
import { stubGithub, unscripted } from "./stub-github.js";
import type { GithubReply, GithubRequest } from "./stub-github.js";

const ToolResult = Schema.Struct({
  isError: Schema.Boolean,
  content: Schema.Array(
    Schema.Struct({ type: Schema.String, text: Schema.String }),
  ),
  structuredContent: Schema.optionalKey(Schema.Unknown),
});

const Response = Schema.Struct({
  jsonrpc: Schema.Literal("2.0"),
  id: Schema.optionalKey(Schema.Union([Schema.Finite, Schema.String])),
  result: Schema.optionalKey(Schema.Unknown),
});

export type McpSessionOptions = {
  /** The environment the server sees; defaults to empty so the host's never leaks in. */
  readonly env?: Record<string, string>;
  /** What GitHub answers; defaults to an error for every request. */
  readonly github?: (request: GithubRequest) => GithubReply;
};

export type McpSession = {
  /** Sends a request and answers with its `result`, skipping notifications the server sends in between. */
  readonly request: (
    method: string,
    params?: unknown,
  ) => Effect.Effect<unknown>;
  /** Calls a tool and answers with its decoded `tools/call` result. */
  readonly callTool: (
    name: string,
    args: Record<string, unknown>,
  ) => Effect.Effect<typeof ToolResult.Type>;
};

const offerResponse =
  (responses: Queue.Queue<typeof Response.Type>) => (line: string) =>
    Schema.decodeUnknownEffect(Response)(JSON.parse(line)).pipe(
      Effect.flatMap((response) => Queue.offer(responses, response)),
      Effect.orDie,
    );

/** Runs `codesaga mcp` in `cwd`; its stdout lines arrive decoded on `responses`, and ending `stdin` stops it. */
const startServer = (cwd: string, options: McpSessionOptions) =>
  Effect.gen(function* () {
    const stdin = yield* Queue.unbounded<Uint8Array, Cause.Done>();
    const stdout = yield* Queue.unbounded<string | Uint8Array>();
    const responses = yield* Queue.unbounded<typeof Response.Type>();
    yield* runCli(["mcp"]).pipe(
      Effect.provideService(WorkingDirectory, cwd),
      Effect.provide([
        NodeServices.layer,
        oxcParserLayer,
        stubGithub(options.github ?? (() => unscripted)).layer,
        Layer.succeed(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnvRecord(options.env ?? {}),
        ),
        Stdio.layerTest({
          stdin: Stream.fromQueue(stdin),
          stdout: () => Sink.forEach((chunk) => Queue.offer(stdout, chunk)),
        }),
      ]),
      Effect.forkScoped,
    );
    yield* Effect.addFinalizer(() => Queue.end(stdin));
    const decoder = new TextDecoder();
    let pending = "";
    yield* Queue.take(stdout).pipe(
      Effect.flatMap((chunk) => {
        pending += typeof chunk === "string" ? chunk : decoder.decode(chunk);
        const complete = pending.split("\n");
        pending = complete.pop() ?? "";
        return Effect.forEach(complete, offerResponse(responses));
      }),
      Effect.forever,
      Effect.forkScoped,
    );
    return { stdin, responses };
  });

/** Starts `codesaga mcp` in `cwd` and completes the MCP handshake; the server stops with the scope. */
export const startMcpSession = (
  cwd: string,
  options: McpSessionOptions = {},
): Effect.Effect<McpSession, never, Scope.Scope> =>
  Effect.gen(function* () {
    const { stdin, responses } = yield* startServer(cwd, options);
    const encoder = new TextEncoder();
    const send = (message: object) =>
      Queue.offer(
        stdin,
        encoder.encode(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`),
      );
    let nextId = 1;
    const request = (method: string, params?: unknown) =>
      Effect.gen(function* () {
        const id = nextId++;
        yield* send({ id, method, params });
        while (true) {
          const response = yield* Queue.take(responses);
          if (response.id === id) {
            return response.result;
          }
        }
      });
    yield* request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "journey", version: "0.0.0" },
    });
    yield* send({ method: "notifications/initialized" });
    return {
      request,
      callTool: (name, args) =>
        request("tools/call", { name, arguments: args }).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(ToolResult)),
          Effect.orDie,
        ),
    };
  });
