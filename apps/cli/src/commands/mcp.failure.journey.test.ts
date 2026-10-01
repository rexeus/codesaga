import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Console,
  Effect,
  Exit,
  Layer,
  Runtime,
  Sink,
  Stdio,
  Stream,
} from "effect";

import { runCli } from "../cli.js";
import { makeTeamProject } from "../testing/projects.js";
import { stubGithub, unscripted } from "../testing/stub-github.js";
import { WorkingDirectory } from "../working-directory.js";

// A host that cannot read stdin leaves no server to run: the build of the server breaks.
const brokenStdio = Stdio.make({
  args: Effect.succeed([]),
  stdout: () => Sink.drain,
  stderr: () => Sink.drain,
  stdin: Stream.empty,
});
Object.defineProperty(brokenStdio, "stdin", {
  get: () => {
    throw new Error("no stdin");
  },
});
const stdioWithoutStdin = Layer.succeed(Stdio.Stdio, brokenStdio);

describe("codesaga mcp when the server breaks", () => {
  it.live("ends with exit code 1 and the error line instead of exiting 0", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      const stderr: Array<string> = [];

      const exit = yield* runCli(["mcp"]).pipe(
        Effect.provideService(WorkingDirectory, repo.root),
        Effect.provideService(Console.Console, {
          ...globalThis.console,
          error: (...values) => {
            stderr.push(values.map(String).join(" "));
          },
        }),
        Effect.provide(
          Layer.mergeAll(
            NodeServices.layer,
            stubGithub(() => unscripted).layer,
            stdioWithoutStdin,
          ),
        ),
        Effect.exit,
      );

      let exitCode = 0;
      Runtime.defaultTeardown(exit, (code) => {
        exitCode = code;
      });
      expect(Exit.isFailure(exit)).toBe(true);
      expect(exitCode).toBe(1);
      expect(stderr).toStrictEqual(["codesaga: unexpected error: no stdin"]);
    }).pipe(Effect.scoped),
  );
});
