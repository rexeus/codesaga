import { describe, expect, it } from "vitest";

import { BlameParser } from "./parse-blame.js";

/**
 * `git blame --line-porcelain -w HEAD -- a.ts` of a file whose first three
 * lines (one of them blank) come from the root commit, a boundary, by
 * `Ada Old <ADA@old.example>`, whom `.mailmap` maps to `Ada Lovelace
 * <ada@example.com>`; Grace added the last two, one of which ends in spaces
 * and one of which holds a carriage return followed by a tab.
 */
const PORCELAIN = [
  "11f44188fce9f588892bf2336acd84913ee5d0bc 1 1 3",
  "author Ada Lovelace",
  "author-mail <ada@example.com>",
  "author-time 1767258000",
  "author-tz +0000",
  "committer T",
  "committer-mail <t@x>",
  "committer-time 1767258000",
  "committer-tz +0000",
  "summary Add a",
  "boundary",
  "filename a.ts",
  "\talpha",
  "11f44188fce9f588892bf2336acd84913ee5d0bc 2 2",
  "author Ada Lovelace",
  "author-mail <ada@example.com>",
  "author-time 1767258000",
  "author-tz +0000",
  "committer T",
  "committer-mail <t@x>",
  "committer-time 1767258000",
  "committer-tz +0000",
  "summary Add a",
  "boundary",
  "filename a.ts",
  "\t",
  "11f44188fce9f588892bf2336acd84913ee5d0bc 3 3",
  "author Ada Lovelace",
  "author-mail <ada@example.com>",
  "author-time 1767258000",
  "author-tz +0000",
  "committer T",
  "committer-mail <t@x>",
  "committer-time 1767258000",
  "committer-tz +0000",
  "summary Add a",
  "boundary",
  "filename a.ts",
  "\tbeta",
  "ec6f78e32b18ee3d99877b9ad2eb89a6d75da072 4 4 2",
  "author Grace",
  "author-mail <grace@example.com>",
  "author-time 1767344400",
  "author-tz +0000",
  "committer T",
  "committer-mail <t@x>",
  "committer-time 1767344400",
  "committer-tz +0000",
  "summary Extend a",
  "previous 11f44188fce9f588892bf2336acd84913ee5d0bc a.ts",
  "filename a.ts",
  "\tgamma  ",
  "ec6f78e32b18ee3d99877b9ad2eb89a6d75da072 5 5",
  "author Grace",
  "author-mail <grace@example.com>",
  "author-time 1767344400",
  "author-tz +0000",
  "committer T",
  "committer-mail <t@x>",
  "committer-time 1767344400",
  "committer-tz +0000",
  "summary Extend a",
  "previous 11f44188fce9f588892bf2336acd84913ee5d0bc a.ts",
  "filename a.ts",
  "\tx\r\tmore",
]
  .map((line) => `${line}\n`)
  .join("");

const parse = (chunks: ReadonlyArray<string>) => {
  const parser = new BlameParser();
  for (const chunk of chunks) {
    parser.push(chunk);
  }
  return [...parser.end()];
};

describe("BlameParser", () => {
  it("counts the non-blank lines per mailmapped, lowercased author", () => {
    expect(parse([PORCELAIN])).toStrictEqual([
      ["ada@example.com", { name: "Ada Lovelace", lines: 2 }],
      ["grace@example.com", { name: "Grace", lines: 2 }],
    ]);
  });

  it("reads the same output split at arbitrary points", () => {
    const pieces = PORCELAIN.match(/[^]{1,37}/gu) ?? [];

    expect(parse(pieces)).toStrictEqual(parse([PORCELAIN]));
  });

  it("reads a final line that git ended without a newline", () => {
    expect(parse([PORCELAIN.slice(0, -1)])).toStrictEqual(parse([PORCELAIN]));
  });
});
