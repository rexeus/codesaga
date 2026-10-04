// Owns spreading sources over parse workers and surviving a worker that dies or hangs.
// A parser that crashes its process cannot say which file did it, so the pool bisects the failed batch on a replacement worker: only the culprits are lost and everything else is still parsed.
// The pool knows nothing of processes; a `PoolWorker` is whatever can parse a batch or die trying; one that stays silent past a timeout that grows with the batch's text is treated as dead.
import type { FactsResult, SourceText } from "@codesaga/engine";

import type { ParseKind } from "./parse-protocol.js";

/** A verdict as the pool passes it on; what its facts are depends on the `ParseKind` asked for. */
type Verdict = FactsResult<unknown>;

/** A parser that answers a batch of sources. */
export type PoolWorker = {
  /** One verdict per source in order, or undefined when the worker died while parsing them. Never rejects; the pool gives up on one that stays silent. */
  readonly run: (
    sources: ReadonlyArray<SourceText>,
    kind: ParseKind,
  ) => Promise<ReadonlyArray<Verdict> | undefined>;
  /** Ends the worker; safe to call on a dead one. */
  readonly stop: () => void;
};

/** What starting a worker came to. */
export type WorkerStart =
  | {
      readonly kind: "ready";
      readonly version: string;
      readonly worker: PoolWorker;
    }
  | { readonly kind: "unavailable"; readonly reason: string };

export type PoolReadiness =
  | { readonly kind: "ready"; readonly version: string }
  | { readonly kind: "unavailable"; readonly reason: string };

export type Pool = {
  /** Starts the first worker if none runs yet and says whether the parser loaded. */
  readonly ready: () => Promise<PoolReadiness>;
  /** One verdict per source in order, with the full facts of each file; never rejects, and files that crash the parser are `parser-crashed`. */
  readonly factsOf: (
    sources: ReadonlyArray<SourceText>,
  ) => Promise<ReadonlyArray<Verdict>>;
  /** The same with the digest of each file, as the history keeps it. */
  readonly digestsOf: (
    sources: ReadonlyArray<SourceText>,
  ) => Promise<ReadonlyArray<Verdict>>;
  /** Ends every worker. */
  readonly stop: () => void;
};

/** Sources per batch. */
const BATCH_FILES = 500;
/** Characters of text per batch, about 32 MB; a single larger source gets a batch to itself. */
const BATCH_CHARACTERS = 32_000_000;
/** Worker deaths one batch may cause before the rest of it is given up; bisecting one culprit takes about two per level. */
const MAX_CRASHES_PER_BATCH = 40;

/** A batch may take this long however small, and a further second per megabyte of its text; a worker that is silent for longer counts as dead. */
const BATCH_TIMEOUT_MS = 30_000;
const BATCH_TIMEOUT_MS_PER_MEGABYTE = 1_000;

const CRASHED: Verdict = { kind: "skipped", reason: "parser-crashed" };

const batchesOf = (
  sources: ReadonlyArray<SourceText>,
): ReadonlyArray<ReadonlyArray<SourceText>> => {
  const batches: Array<Array<SourceText>> = [];
  let characters = 0;
  for (const source of sources) {
    const current = batches.at(-1);
    if (
      current === undefined ||
      current.length >= BATCH_FILES ||
      characters + source.text.length > BATCH_CHARACTERS
    ) {
      batches.push([source]);
      characters = source.text.length;
    } else {
      current.push(source);
      characters += source.text.length;
    }
  }
  return batches;
};

const timeoutOf = (sources: Batch): number =>
  BATCH_TIMEOUT_MS +
  (BATCH_TIMEOUT_MS_PER_MEGABYTE *
    sources.reduce((sum, { text }) => sum + text.length, 0)) /
    1_000_000;

/** The work's answer, or undefined once `milliseconds` pass without one. */
const within = async <A>(
  work: Promise<A>,
  milliseconds: number,
): Promise<A | undefined> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const silence = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      resolve(undefined);
    }, milliseconds);
  });
  try {
    return await Promise.race([work, silence]);
  } finally {
    clearTimeout(timer);
  }
};

/** The worker a lane parses with, which it replaces when it dies. */
type Lane = { worker: PoolWorker | undefined; crashes: number };

type Batch = ReadonlyArray<SourceText>;

/** One call of the pool: its batches, where the verdicts go, which batch is next, and what the verdicts hold. */
type Call = {
  readonly batches: ReadonlyArray<Batch>;
  readonly results: Array<ReadonlyArray<Verdict> | undefined>;
  readonly next: () => number;
  readonly kind: ParseKind;
};

class WorkerPool implements Pool {
  readonly #start: () => Promise<WorkerStart>;
  readonly #size: number;
  readonly #alive = new Set<PoolWorker>();
  readonly #idle: Array<PoolWorker> = [];
  #first: Promise<WorkerStart> | undefined;

  constructor(start: () => Promise<WorkerStart>, size: number) {
    this.#start = start;
    this.#size = size;
  }

  async ready(): Promise<PoolReadiness> {
    this.#first ??= this.#startWorker().then((started) => {
      if (started.kind === "ready") {
        this.#idle.push(started.worker);
      }
      return started;
    });
    const started = await this.#first;
    return started.kind === "ready"
      ? { kind: "ready", version: started.version }
      : started;
  }

  factsOf(sources: ReadonlyArray<SourceText>): Promise<ReadonlyArray<Verdict>> {
    return this.#parseAll(sources, "facts");
  }

  digestsOf(
    sources: ReadonlyArray<SourceText>,
  ): Promise<ReadonlyArray<Verdict>> {
    return this.#parseAll(sources, "digest");
  }

  async #parseAll(
    sources: ReadonlyArray<SourceText>,
    kind: ParseKind,
  ): Promise<ReadonlyArray<Verdict>> {
    if ((await this.ready()).kind !== "ready") {
      return sources.map(() => CRASHED);
    }
    const batches = batchesOf(sources);
    const results: Array<ReadonlyArray<Verdict> | undefined> = [];
    let cursor = 0;
    const next = () => cursor++;
    await Promise.all(
      Array.from({ length: Math.min(this.#size, batches.length) }, () =>
        this.#runLane({ batches, results, next, kind }),
      ),
    );
    return batches.flatMap(
      (batch, index) => results[index] ?? batch.map(() => CRASHED),
    );
  }

  stop(): void {
    for (const worker of this.#alive) {
      worker.stop();
    }
    this.#alive.clear();
    this.#idle.length = 0;
  }

  async #startWorker(): Promise<WorkerStart> {
    const started = await this.#start();
    if (started.kind === "ready") {
      this.#alive.add(started.worker);
    }
    return started;
  }

  async #claimWorker(): Promise<PoolWorker | undefined> {
    const reused = this.#idle.pop();
    if (reused !== undefined) {
      return reused;
    }
    const started = await this.#startWorker();
    return started.kind === "ready" ? started.worker : undefined;
  }

  /** Ends the lane's dead worker and starts its replacement; past the crash budget there is none. */
  async #replace(lane: Lane): Promise<void> {
    if (lane.worker !== undefined) {
      lane.worker.stop();
      this.#alive.delete(lane.worker);
    }
    lane.crashes += 1;
    if (lane.crashes > MAX_CRASHES_PER_BATCH) {
      lane.worker = undefined;
      return;
    }
    const started = await this.#startWorker();
    lane.worker = started.kind === "ready" ? started.worker : undefined;
  }

  async #parse(
    lane: Lane,
    sources: Batch,
    kind: ParseKind,
  ): Promise<ReadonlyArray<Verdict>> {
    if (lane.worker === undefined) {
      return sources.map(() => CRASHED);
    }
    const results = await within(
      lane.worker.run(sources, kind),
      timeoutOf(sources),
    );
    if (results !== undefined) {
      return results;
    }
    await this.#replace(lane);
    if (sources.length === 1) {
      return [CRASHED];
    }
    const middle = sources.length >> 1;
    return [
      ...(await this.#parse(lane, sources.slice(0, middle), kind)),
      ...(await this.#parse(lane, sources.slice(middle), kind)),
    ];
  }

  async #runLane(call: Call): Promise<void> {
    const lane: Lane = { worker: await this.#claimWorker(), crashes: 0 };
    await this.#drain(lane, call);
    if (lane.worker !== undefined) {
      this.#idle.push(lane.worker);
    }
  }

  /** Takes the next unparsed batch until none is left or the lane has no worker. */
  async #drain(lane: Lane, call: Call): Promise<void> {
    if (lane.worker === undefined) {
      return;
    }
    const index = call.next();
    if (index >= call.batches.length) {
      return;
    }
    lane.crashes = 0;
    call.results[index] = await this.#parse(
      lane,
      call.batches[index] ?? [],
      call.kind,
    );
    await this.#drain(lane, call);
  }
}

/**
 * A pool of at most `size` workers from `start`, each parsing one batch at a
 * time. Workers are started when a call needs them and kept for the next one.
 */
export const makePool = (
  start: () => Promise<WorkerStart>,
  size: number,
): Pool => new WorkerPool(start, size);
