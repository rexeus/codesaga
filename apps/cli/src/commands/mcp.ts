import { Effect, Fiber, Layer } from "effect";
import { Command } from "effect/cli";

import { McpServerLive } from "../mcp/server.js";

export const mcpCommand = Command.make(
  "mcp",
  {},
  Effect.fn(function* () {
    // The server interrupts its own fiber when stdin closes, so it runs in a child.
    const server = yield* Layer.launch(McpServerLive).pipe(Effect.forkChild);
    yield* Fiber.await(server);
  }),
).pipe(
  Command.withDescription(
    "Serve analyze, inspect and check as MCP tools over stdio until stdin closes, for agent hosts. Runs in the current directory's repository.",
  ),
  Command.withExamples([
    {
      command: "claude mcp add codesaga -- npx codesaga mcp",
      description: "Register codesaga with Claude Code",
    },
  ]),
);
