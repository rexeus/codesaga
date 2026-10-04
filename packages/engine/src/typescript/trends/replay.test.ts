import { describe, expect, it } from "vitest";

import { digestWith } from "../../testing/file-digest.js";
import type { FileDigest } from "../digest/file-digest.js";
import { MEASURES } from "./file-counts.js";
import { monthlyTotals, monthOf } from "./replay.js";

const ANY = MEASURES.indexOf("any");
const FILES = MEASURES.indexOf("files");
const ESM = MEASURES.indexOf("esmFiles");

/** Digests named by blob id. */
const blobs = new Map<string, FileDigest>([
  ["one", digestWith({ any: 1 })],
  ["three", digestWith({ any: 3 })],
  ["two", digestWith({ any: 2 })],
  ["esm", digestWith({ esm: true })],
  ["cjs", digestWith({ commonjs: true })],
]);
/** Digests exist for scripts only, as the history's facts have them. */
const lookup = (oid: string, path: string) =>
  path.endsWith(".md") ? undefined : blobs.get(oid);

const at = (day: string) => Date.parse(`${day}T12:00:00Z`) / 1000;

type Change = {
  path: string;
  oid?: string;
  previousOid?: string;
};
const add = (path: string, oid: string): Change => ({ path, oid });
const edit = (path: string, oid: string, previousOid: string): Change => ({
  path,
  oid,
  previousOid,
});
const remove = (path: string, previousOid: string): Change => ({
  path,
  previousOid,
});

const jan = monthOf(at("2026-01-15"));

/** `[files, any]` of production code after each of `months` months from January. */
const replay = (
  commits: ReadonlyArray<{
    time: number;
    changes: ReadonlyArray<Change>;
    line?: number;
    absorbs?: ReadonlyArray<number>;
  }>,
  months: number,
) =>
  monthlyTotals({
    commits,
    lookup,
    firstMonth: jan,
    lastMonth: jan + months - 1,
  }).map(([files]) => [files?.[FILES], files?.[ANY]]);

describe("monthlyTotals along the chain", () => {
  it("ends a month in the state after the last commit dated in it, and repeats a month without a commit", () => {
    const points = replay(
      [
        { time: at("2026-01-10"), changes: [add("a.ts", "one")] },
        { time: at("2026-04-10"), changes: [edit("a.ts", "two", "one")] },
      ],
      4,
    );

    expect(points).toStrictEqual([
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 2],
    ]);
  });

  it("puts the head's tree in the last month whatever the dates of the last commits say", () => {
    const points = replay(
      [
        { time: at("2026-01-10"), changes: [add("a.ts", "one")] },
        { time: at("2999-01-01"), changes: [edit("a.ts", "three", "one")] },
        { time: Number.NaN, changes: [add("b.ts", "two")] },
      ],
      2,
    );

    expect(points).toStrictEqual([
      [1, 1],
      [2, 5],
    ]);
  });

  it("dates a commit that came after later ones where it says, with everything before it in the chain", () => {
    const points = replay(
      [
        { time: at("2026-02-10"), changes: [add("a.ts", "one")] },
        { time: at("2026-01-20"), changes: [edit("a.ts", "three", "one")] },
        { time: at("2026-03-10"), changes: [add("b.ts", "two")] },
      ],
      3,
    );

    expect(points).toStrictEqual([
      [1, 3],
      [1, 3],
      [2, 5],
    ]);
  });
});

describe("monthlyTotals over merges and renames", () => {
  it("leaves no ghost file when a merge brings a rename and an edit together", () => {
    const points = replay(
      [
        { time: at("2026-01-10"), changes: [add("a.ts", "one")] },
        { time: at("2026-02-10"), changes: [edit("a.ts", "two", "one")] },
        {
          // The merge against its first parent: a.ts is gone, b.ts holds the edit.
          time: at("2026-03-10"),
          changes: [remove("a.ts", "two"), add("b.ts", "three")],
        },
      ],
      3,
    );

    expect(points).toStrictEqual([
      [1, 1],
      [1, 2],
      [1, 3],
    ]);
  });

  it("holds the new file when a rename lands on a deleted path", () => {
    const points = replay(
      [
        {
          time: at("2026-01-10"),
          changes: [add("a.ts", "one"), add("b.ts", "two")],
        },
        { time: at("2026-02-10"), changes: [remove("a.ts", "one")] },
        {
          time: at("2026-03-10"),
          changes: [remove("b.ts", "two"), add("a.ts", "three")],
        },
      ],
      3,
    );

    expect(points).toStrictEqual([
      [2, 3],
      [1, 2],
      [1, 3],
    ]);
  });
});

describe("monthlyTotals over added files and a changed extension", () => {
  it("counts a file a merge adds, and drops a .ts that became a .md", () => {
    const points = replay(
      [
        { time: at("2026-01-10"), changes: [add("doc.ts", "one")] },
        {
          time: at("2026-02-10"),
          changes: [add("side.ts", "two"), add("evil.ts", "three")],
        },
        {
          time: at("2026-03-10"),
          changes: [remove("doc.ts", "one"), add("doc.md", "one")],
        },
      ],
      3,
    );

    expect(points).toStrictEqual([
      [1, 1],
      [3, 6],
      [2, 5],
    ]);
  });
});

describe("monthlyTotals by path at the time", () => {
  it("counts a file as a test while it has a test path, and as production while it has not", () => {
    const [, point] = monthlyTotals({
      commits: [
        { time: at("2026-01-10"), changes: [add("src/a.test.ts", "one")] },
        {
          time: at("2026-02-10"),
          changes: [remove("src/a.test.ts", "one"), add("src/a.ts", "one")],
        },
      ],
      lookup,
      firstMonth: jan,
      lastMonth: jan + 1,
    });

    expect([point?.[0][ANY], point?.[1][ANY]]).toStrictEqual([1, 0]);
  });

  it("leaves a tooling config out of the module-system counts, whatever syntax it uses", () => {
    const [production] = monthlyTotals({
      commits: [
        {
          time: at("2026-01-10"),
          changes: [
            add("src/a.js", "cjs"),
            add("src/b.js", "esm"),
            add("jest.config.js", "cjs"),
            add("vite.config.ts", "esm"),
          ],
        },
      ],
      lookup,
      firstMonth: jan,
      lastMonth: jan,
    });

    expect([
      production?.[0][FILES],
      production?.[0][ESM],
      production?.[0][MEASURES.indexOf("commonjsFiles")],
    ]).toStrictEqual([4, 1, 1]);
  });
});

describe("monthlyTotals over absorbed histories", () => {
  it("counts an absorbed history in the months before the chain begins, and its files once after the merge that took them in", () => {
    const points = replay(
      [
        { time: at("2026-01-05"), line: 1, changes: [add("x.ts", "one")] },
        {
          time: at("2026-01-10"),
          line: 1,
          changes: [edit("x.ts", "three", "one")],
        },
        { time: at("2026-01-20"), changes: [add("a.ts", "two")] },
        {
          time: at("2026-03-10"),
          absorbs: [1],
          changes: [add("x.ts", "three")],
        },
      ],
      3,
    );

    expect(points).toStrictEqual([
      [2, 5],
      [2, 5],
      [2, 5],
    ]);
  });
});

describe("monthlyTotals over histories that share paths", () => {
  it("keeps a path that two histories hold apart, and leaves the merge's own version of it", () => {
    const points = replay(
      [
        { time: at("2026-01-05"), line: 1, changes: [add("a.ts", "one")] },
        { time: at("2026-01-20"), changes: [add("a.ts", "two")] },
        {
          time: at("2026-02-10"),
          absorbs: [1],
          changes: [edit("a.ts", "three", "two")],
        },
      ],
      2,
    );

    expect(points).toStrictEqual([
      [2, 3],
      [1, 3],
    ]);
  });

  it("ends a history that an absorbed history absorbed where its own merge is", () => {
    const points = replay(
      [
        { time: at("2026-01-05"), line: 2, changes: [add("q.ts", "one")] },
        { time: at("2026-01-06"), line: 1, changes: [add("p.ts", "two")] },
        {
          time: at("2026-01-07"),
          line: 1,
          absorbs: [2],
          changes: [add("q.ts", "one")],
        },
        {
          time: at("2026-02-10"),
          absorbs: [1],
          changes: [add("p.ts", "two"), add("q.ts", "one")],
        },
      ],
      2,
    );

    expect(points).toStrictEqual([
      [2, 3],
      [2, 3],
    ]);
  });
});
