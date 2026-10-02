import type { FactsResult, SourceText } from "@codesaga/engine";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makePool } from "./parse-pool.js";
import type { PoolWorker, WorkerStart } from "./parse-pool.js";

const PARSED: FactsResult = {
  kind: "parsed",
  facts: { version: 1, nodes: 1 },
};
const CRASHED: FactsResult = { kind: "skipped", reason: "parser-crashed" };

const sources = (...paths: ReadonlyArray<string>): Array<SourceText> =>
  paths.map((path) => ({ path, text: "x" }));

type Fleet = {
  readonly start: () => Promise<WorkerStart>;
  /** Every batch a worker was asked to parse, as paths, with the worker's number. */
  readonly batches: Array<{
    readonly worker: number;
    readonly paths: string[];
  }>;
  readonly started: () => number;
  readonly stopped: () => number;
};

/** Workers that die on any batch holding a path in `poison`, as a parser that crashes its process does. */
const fleet = (poison: ReadonlyArray<string>): Fleet => {
  const batches: Fleet["batches"] = [];
  let started = 0;
  let stopped = 0;
  const start = (): Promise<WorkerStart> => {
    started += 1;
    const number = started;
    const worker: PoolWorker = {
      run: (batch) => {
        batches.push({ worker: number, paths: batch.map(({ path }) => path) });
        return Promise.resolve(
          batch.some(({ path }) => poison.includes(path))
            ? undefined
            : batch.map(() => PARSED),
        );
      },
      stop: () => {
        stopped += 1;
      },
    };
    return Promise.resolve({ kind: "ready", version: "1.2.3", worker });
  };
  return { start, batches, started: () => started, stopped: () => stopped };
};

const text = (megabytes: number): string => "x".repeat(megabytes * 1_000_000);

describe("makePool answers", () => {
  it("says which version the first worker loaded", async () => {
    const pool = makePool(fleet([]).start, 2);

    expect(await pool.ready()).toStrictEqual({
      kind: "ready",
      version: "1.2.3",
    });
  });

  it("answers one verdict per source in order", async () => {
    const pool = makePool(fleet([]).start, 2);

    expect(await pool.factsOf(sources("a", "b", "c"))).toStrictEqual([
      PARSED,
      PARSED,
      PARSED,
    ]);
  });

  it("loses only the file that crashes the parser, finding it by bisecting the batch", async () => {
    const { start, batches } = fleet(["d"]);
    const pool = makePool(start, 1);

    const results = await pool.factsOf(sources("a", "b", "c", "d", "e", "f"));

    expect(results).toStrictEqual([
      PARSED,
      PARSED,
      PARSED,
      CRASHED,
      PARSED,
      PARSED,
    ]);
    expect(batches.map(({ paths }) => paths.join(""))).toStrictEqual([
      "abcdef",
      "abc",
      "def",
      "d",
      "ef",
    ]);
  });

  it("replaces every worker that died and stops it", async () => {
    const { start, started, stopped } = fleet(["b"]);
    const pool = makePool(start, 1);

    await pool.factsOf(sources("a", "b"));

    // the first worker, then one per crash: "ab" and "b"
    expect(started()).toBe(3);
    expect(stopped()).toBe(2);
  });

  it("loses each crashing file of a batch and no other", async () => {
    const pool = makePool(fleet(["b", "e"]).start, 1);

    const results = await pool.factsOf(sources("a", "b", "c", "d", "e", "f"));

    expect(results.map(({ kind }) => kind)).toStrictEqual([
      "parsed",
      "skipped",
      "parsed",
      "parsed",
      "skipped",
      "parsed",
    ]);
  });
});

describe("makePool giving up", () => {
  it("gives up on the rest of a batch after too many deaths, so a hostile batch ends", async () => {
    const paths = Array.from({ length: 200 }, (_, index) => `f${index}`);
    const { start, started } = fleet(paths);
    const pool = makePool(start, 1);

    const results = await pool.factsOf(sources(...paths));

    expect(results).toStrictEqual(paths.map(() => CRASHED));
    expect(started()).toBeLessThanOrEqual(42);
  });
});

describe("makePool batches and workers", () => {
  it("splits sources into batches of at most 500 files", async () => {
    const { start, batches } = fleet([]);
    const pool = makePool(start, 1);

    await pool.factsOf(
      sources(...Array.from({ length: 1_001 }, (_, i) => `f${i}`)),
    );

    expect(batches.map(({ paths }) => paths.length)).toStrictEqual([
      500, 500, 1,
    ]);
  });

  it("splits sources into batches of about 32 MB of text, and a larger source goes alone", async () => {
    const { start, batches } = fleet([]);
    const pool = makePool(start, 1);

    await pool.factsOf([
      { path: "a", text: text(20) },
      { path: "b", text: text(10) },
      { path: "c", text: text(10) },
      { path: "d", text: text(40) },
      { path: "e", text: text(1) },
    ]);

    expect(batches.map(({ paths }) => paths.join(""))).toStrictEqual([
      "ab",
      "c",
      "d",
      "e",
    ]);
  });

  it("parses batches on up to `size` workers at once and reuses them for the next call", async () => {
    const { start, batches, started } = fleet([]);
    const pool = makePool(start, 3);
    const many = sources(...Array.from({ length: 1_500 }, (_, i) => `f${i}`));

    await pool.factsOf(many);
    await pool.factsOf(many);

    expect(started()).toBe(3);
    expect(new Set(batches.map(({ worker }) => worker))).toStrictEqual(
      new Set([1, 2, 3]),
    );
  });

  it("starts no more workers than there are batches", async () => {
    const { start, started } = fleet([]);
    const pool = makePool(start, 4);

    await pool.factsOf(sources("a", "b"));

    expect(started()).toBe(1);
  });
});

describe("makePool starting and stopping", () => {
  it("is unavailable, and parses nothing, when the first worker cannot load the parser", async () => {
    const pool = makePool(
      () => Promise.resolve({ kind: "unavailable", reason: "no binding" }),
      2,
    );

    expect(await pool.ready()).toStrictEqual({
      kind: "unavailable",
      reason: "no binding",
    });
  });

  it("gives up on a batch when no replacement worker can start", async () => {
    let starts = 0;
    const base = fleet(["b"]);
    const pool = makePool(() => {
      starts += 1;
      return starts === 1
        ? base.start()
        : Promise.resolve({ kind: "unavailable", reason: "gone" });
    }, 1);

    const results = await pool.factsOf(sources("a", "b"));

    expect(results).toStrictEqual([CRASHED, CRASHED]);
  });

  it("stops every worker", async () => {
    const { start, stopped } = fleet([]);
    const pool = makePool(start, 2);
    await pool.factsOf(sources("a"));

    pool.stop();

    expect(stopped()).toBe(1);
  });
});

/** Workers that never answer a batch holding a path in `hang`. */
const hanging = (hang: ReadonlyArray<string>) => {
  const stopped: Array<number> = [];
  let started = 0;
  const start = (): Promise<WorkerStart> => {
    started += 1;
    const number = started;
    return Promise.resolve({
      kind: "ready",
      version: "1.2.3",
      worker: {
        run: (batch) =>
          batch.some(({ path }) => hang.includes(path))
            ? new Promise<never>(() => {
                // never answers
              })
            : Promise.resolve(batch.map(() => PARSED)),
        stop: () => {
          stopped.push(number);
        },
      },
    });
  };
  return { start, stopped };
};

describe("makePool with a worker that hangs", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a silent worker as dead and loses only the file that hangs it", async () => {
    vi.useFakeTimers();
    const { start, stopped } = hanging(["b"]);
    const pool = makePool(start, 1);

    const answer = pool.factsOf(sources("a", "b", "c"));
    await vi.runAllTimersAsync();

    expect(await answer).toStrictEqual([PARSED, CRASHED, PARSED]);
    // silent on "abc", on "bc" and on "b"; the fourth parses "c"
    expect(stopped).toStrictEqual([1, 2, 3]);
  });

  it("waits 30 s plus a second per megabyte of text before it gives up", async () => {
    vi.useFakeTimers();
    const { start, stopped } = hanging(["big"]);
    const pool = makePool(start, 1);

    const answer = pool.factsOf([
      { path: "big", text: "x".repeat(20_000_000) },
    ]);
    await vi.advanceTimersByTimeAsync(49_999);
    expect(stopped).toStrictEqual([]);
    await vi.advanceTimersByTimeAsync(2);

    expect(await answer).toStrictEqual([CRASHED]);
    expect(stopped).toStrictEqual([1]);
  });
});
