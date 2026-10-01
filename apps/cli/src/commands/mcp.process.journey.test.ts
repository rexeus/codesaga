import { spawn } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { makeTeamProject } from "../testing/projects.js";

const application = join(import.meta.dirname, "..", "..");
const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "process-journey", version: "0.0.0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "inspect", arguments: { patterns: ["src/a.ts"] } },
  },
];

/** Runs `codesaga mcp` as a real process; stdin closes once the last request is answered. */
const runServer = (cwd: string) =>
  Effect.promise(
    () =>
      new Promise<{ stdout: string; stderr: string; code: number | null }>(
        (resolve) => {
          const server = spawn(
            join(application, "node_modules", ".bin", "tsx"),
            [join(application, "src", "bin.ts"), "mcp"],
            { cwd },
          );
          let stdout = "";
          let stderr = "";
          server.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
            if (stdout.includes('"id":3')) {
              server.stdin.end();
            }
          });
          server.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
          });
          server.on("close", (code) => {
            resolve({ stdout, stderr, code });
          });
          for (const request of requests) {
            server.stdin.write(`${JSON.stringify(request)}\n`);
          }
        },
      ),
  );

// Real clock and process: the commits are dated relative to now.
describe("codesaga mcp as a process", () => {
  it.live(
    "answers over stdout with JSON-RPC lines only and exits 0 when stdin closes",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;

        const result = yield* runServer(repo.root);

        const lines = result.stdout.trim().split("\n");
        const messages = lines.map((line): unknown => JSON.parse(line));
        expect(messages).toSatisfy((all: ReadonlyArray<unknown>) =>
          all.every(
            (message) =>
              typeof message === "object" &&
              message !== null &&
              "jsonrpc" in message &&
              message.jsonrpc === "2.0",
          ),
        );
        expect(lines.filter((line) => line.includes('"id":'))).toHaveLength(3);
        expect(result.stderr).toBe("");
        expect(result.code).toBe(0);
      }).pipe(Effect.scoped),
    30_000,
  );
});
