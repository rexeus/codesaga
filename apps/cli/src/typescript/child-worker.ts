// Owns running a parse worker as a child process that re-enters this program.
// The child is `fork`ed from the entry file with the parse-child switch set; it imports the native parser, so a crash of that parser ends the child and nothing else.
import { fork } from "node:child_process";

import type { FactsResult, SourceText } from "@codesaga/engine";

import type { PoolWorker, WorkerStart } from "./parse-pool.js";
import {
  isChildReady,
  isParseReply,
  PARSE_CHILD_ENV,
} from "./parse-protocol.js";
import type { ParseKind } from "./parse-protocol.js";

/** How to start the program again as a parse child. */
export type ChildCommand = {
  /** The program's entry file, which runs `parse-child` when the switch is set. */
  readonly entry: string;
  /** Runtime flags the entry needs, such as the TypeScript loader of a development run. */
  readonly execArgv: ReadonlyArray<string>;
};

type Verdicts = ReadonlyArray<FactsResult<unknown>> | undefined;

/**
 * Starts one child and resolves when it says whether the parser loaded.
 * Never rejects: a child that cannot start or dies before it is ready is
 * `unavailable`, and one that dies later makes its pending `run` answer
 * undefined.
 */
export const forkWorker = (command: ChildCommand): Promise<WorkerStart> =>
  new Promise((resolve) => {
    // Standard output stays closed, so nothing a child prints can reach a `--json` document.
    const child = fork(command.entry, [], {
      env: { ...process.env, [PARSE_CHILD_ENV]: "1" },
      execArgv: [...command.execArgv],
      stdio: ["ignore", "ignore", "inherit", "ipc"],
      serialization: "advanced",
    });
    let pending: ((verdicts: Verdicts) => void) | undefined;
    let started = false;

    const worker: PoolWorker = {
      run: (sources: ReadonlyArray<SourceText>, kind: ParseKind) =>
        new Promise<Verdicts>((done) => {
          pending = (verdicts) => {
            done(verdicts?.length === sources.length ? verdicts : undefined);
          };
          child.send({ type: "parse", kind, sources }, (error) => {
            if (error !== null) {
              pending?.(undefined);
              pending = undefined;
            }
          });
        }),
      stop: () => {
        child.kill();
      },
    };
    const start = (result: WorkerStart): void => {
      if (!started) {
        started = true;
        resolve(result);
      }
    };
    const died = (reason: string): void => {
      pending?.(undefined);
      pending = undefined;
      start({ kind: "unavailable", reason });
    };

    child.on("message", (message: unknown) => {
      if (isChildReady(message)) {
        start(
          message.type === "ready"
            ? { kind: "ready", version: message.version, worker }
            : { kind: "unavailable", reason: message.reason },
        );
      } else if (isParseReply(message)) {
        const answer = pending;
        pending = undefined;
        answer?.(message.results);
      }
    });
    child.on("error", (error) => {
      died(error.message);
    });
    child.on("exit", () => {
      died("the parser process exited before it was ready");
    });
  });
