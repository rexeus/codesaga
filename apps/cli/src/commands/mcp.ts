import { Cause, Effect, Exit, Fiber, Layer } from "effect";
import { Command } from "effect/cli";

import { McpServerLive } from "../mcp/server.js";

export const mcpCommand = Command.make(
  "mcp",
  {},
  Effect.fn(function* () {
    // The server interrupts its own fiber when stdin closes, so it runs in a child.
    const server = yield* Layer.launch(McpServerLive).pipe(Effect.forkChild);
    const exit = yield* Fiber.await(server);
    // Closing stdin is the normal end; anything else is a server that broke.
    return yield* Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)
      ? Effect.die(Cause.squash(exit.cause))
      : Effect.void;
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
