import { describe, expect, it } from "vitest";

import { revisionsOf } from "./revisions.js";

const change = (path: string, previousLife?: true) => ({
  path,
  added: 1,
  deleted: 0,
  ...(previousLife === undefined ? {} : { previousLife }),
});

describe("revisionsOf", () => {
  it("counts the commits that changed each path", () => {
    const revisions = revisionsOf([
      { changes: [change("a.ts"), change("b.ts")] },
      { changes: [change("a.ts")] },
      { changes: [change("a.ts")] },
    ]);

    expect(revisions).toStrictEqual(
      new Map([
        ["a.ts", 3],
        ["b.ts", 1],
      ]),
    );
  });

  it("counts a commit once for a path it changes twice", () => {
    expect(
      revisionsOf([{ changes: [change("a.ts"), change("a.ts")] }]),
    ).toStrictEqual(new Map([["a.ts", 1]]));
  });

  it("leaves out the changes of an earlier life of the path", () => {
    const revisions = revisionsOf([
      { changes: [change("a.ts")] },
      { changes: [change("a.ts", true)] },
      { changes: [change("old.ts", true)] },
    ]);

    expect(revisions).toStrictEqual(new Map([["a.ts", 1]]));
  });
});
