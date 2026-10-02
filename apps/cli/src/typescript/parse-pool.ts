// Owns spreading sources over parse workers and surviving a worker that dies.
// A parser that crashes its process cannot say which file did it, so the pool bisects the failed batch on a replacement worker: only the culprits are lost and everything else is still parsed.
// The pool knows nothing of processes; a `PoolWorker` is whatever can parse a batch or die trying.
import type { FactsResult, SourceText } from "@codesaga/engine";

/** A parser that answers a batch of sources. */
export type PoolWorker = {
  /** One verdict per source in order, or undefined when the worker died while parsing them. Never rejects. */
  readonly run: (
    sources: ReadonlyArray<SourceText>,
  ) => Promise<ReadonlyArray<FactsResult> | undefined>;
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
  /** One verdict per source in order; never rejects, and files that crash the parser are `parser-crashed`. */
  readonly factsOf: (
    sources: ReadonlyArray<SourceText>,
  ) => Promise<ReadonlyArray<FactsResult>>;
  /** Ends every worker. */
  readonly stop: () => void;
};

/** Sources per batch. */
const BATCH_FILES = 500;
/** Characters of text per batch, about 32 MB; a single larger source gets a batch to itself. */
const BATCH_CHARACTERS = 32_000_000;
/** Worker deaths one batch may cause before the rest of it is given up; bisecting one culprit takes about two per level. */
const MAX_CRASHES_PER_BATCH = 40;

const CRASHED: FactsResult = { kind: "skipped", reason: "parser-crashed" };

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

/** The worker a lane parses with, which it replaces when it dies. */
type Lane = { worker: PoolWorker | undefined; crashes: number };

type Batch = ReadonlyArray<SourceText>;

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

  async factsOf(
    sources: ReadonlyArray<SourceText>,
  ): Promise<ReadonlyArray<FactsResult>> {
    if ((await this.ready()).kind !== "ready") {
      return sources.map(() => CRASHED);
    }
    const batches = batchesOf(sources);
    const results: Array<ReadonlyArray<FactsResult> | undefined> = [];
    let cursor = 0;
    const next = () => cursor++;
    await Promise.all(
      Array.from({ length: Math.min(this.#size, batches.length) }, () =>
        this.#runLane(batches, results, next),
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
  ): Promise<ReadonlyArray<FactsResult>> {
    if (lane.worker === undefined) {
      return sources.map(() => CRASHED);
    }
    const results = await lane.worker.run(sources);
    if (results !== undefined) {
      return results;
    }
    await this.#replace(lane);
    if (sources.length === 1) {
      return [CRASHED];
    }
    const middle = sources.length >> 1;
    return [
      ...(await this.#parse(lane, sources.slice(0, middle))),
      ...(await this.#parse(lane, sources.slice(middle))),
    ];
  }

  async #runLane(
    batches: ReadonlyArray<Batch>,
    results: Array<ReadonlyArray<FactsResult> | undefined>,
    next: () => number,
  ): Promise<void> {
    const lane: Lane = { worker: await this.#claimWorker(), crashes: 0 };
    await this.#drain(lane, batches, results, next);
    if (lane.worker !== undefined) {
      this.#idle.push(lane.worker);
    }
  }

  /** Takes the next unparsed batch until none is left or the lane has no worker. */
  async #drain(
    lane: Lane,
    batches: ReadonlyArray<Batch>,
    results: Array<ReadonlyArray<FactsResult> | undefined>,
    next: () => number,
  ): Promise<void> {
    if (lane.worker === undefined) {
      return;
    }
    const index = next();
    if (index >= batches.length) {
      return;
    }
    lane.crashes = 0;
    results[index] = await this.#parse(lane, batches[index] ?? []);
    await this.#drain(lane, batches, results, next);
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
