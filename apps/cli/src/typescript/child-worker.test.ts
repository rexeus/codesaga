import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { forkWorker } from "./child-worker.js";

const directories: Array<string> = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** A program that stands in for the parse child, run by node itself. */
const program = (source: string) => {
  const directory = mkdtempSync(join(tmpdir(), "codesaga-child-"));
  directories.push(directory);
  const entry = join(directory, "child.mjs");
  writeFileSync(entry, source);
  return { entry, execArgv: [] };
};

const PARSED = { kind: "parsed", facts: { version: 1, nodes: 1 } };

const answering = (reply: string) => `
  process.on("message", (message) => {
    process.send({ type: "verdicts", results: ${reply} });
  });
  process.send({ type: "ready", version: "7.7.7" });
`;

describe("forkWorker starting", () => {
  it("starts a child that reports its version and answers batches", async () => {
    const started = await forkWorker(
      program(
        answering(`message.sources.map(() => (${JSON.stringify(PARSED)}))`),
      ),
    );

    expect(started).toMatchObject({ kind: "ready", version: "7.7.7" });
    if (started.kind === "ready") {
      const results = await started.worker.run(
        [
          { path: "a.ts", text: "a" },
          { path: "b.ts", text: "b" },
        ],
        "facts",
      );
      expect(results).toStrictEqual([PARSED, PARSED]);
      started.worker.stop();
    }
  });

  it("is unavailable with the child's reason when it could not load the parser", async () => {
    const started = await forkWorker(
      program(
        `process.send({ type: "unavailable", reason: "Cannot find native binding." }, () => process.exit(0));`,
      ),
    );

    expect(started).toStrictEqual({
      kind: "unavailable",
      reason: "Cannot find native binding.",
    });
  });

  it("is unavailable when the child dies before it is ready", async () => {
    const started = await forkWorker(program("process.exit(3);"));

    expect(started.kind).toBe("unavailable");
  });

  it("is unavailable when the program cannot be started at all", async () => {
    const started = await forkWorker({
      entry: "/nonexistent/codesaga.js",
      execArgv: [],
    });

    expect(started.kind).toBe("unavailable");
  });
});

describe("forkWorker when the child dies", () => {
  it("answers undefined for a batch whose child is killed by a signal", async () => {
    const started = await forkWorker(
      program(`
        process.on("message", () => process.kill(process.pid, "SIGSEGV"));
        process.send({ type: "ready", version: "7.7.7" });
      `),
    );

    expect(started.kind).toBe("ready");
    if (started.kind === "ready") {
      expect(
        await started.worker.run([{ path: "a.ts", text: "a" }], "facts"),
      ).toBeUndefined();
    }
  });

  it("answers undefined for a reply that does not match the batch", async () => {
    const started = await forkWorker(program(answering(`[]`)));

    if (started.kind === "ready") {
      expect(
        await started.worker.run([{ path: "a.ts", text: "a" }], "facts"),
      ).toBeUndefined();
      started.worker.stop();
    }
  });

  it("answers undefined once the worker is stopped", async () => {
    const started = await forkWorker(program(answering(`[]`)));

    if (started.kind === "ready") {
      started.worker.stop();
      expect(
        await started.worker.run([{ path: "a.ts", text: "a" }], "facts"),
      ).toBeUndefined();
    }
  });
});
