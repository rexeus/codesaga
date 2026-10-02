import { describe, expect, it } from "vitest";

import { blobsOfHistory } from "./history-blobs.js";

const oid = (digit: string) => digit.repeat(40);

describe("blobsOfHistory", () => {
  it("names each blob under every path it was met under, before and after a change, with the mode of that version", () => {
    const blobs = blobsOfHistory(
      [
        {
          changes: [
            {
              path: "a.ts",
              added: 1,
              deleted: 1,
              oid: oid("b"),
              previousOid: oid("a"),
              mode: "100644",
              previousMode: "120000",
            },
            {
              path: "copy.ts",
              added: 1,
              deleted: 0,
              oid: oid("b"),
              mode: "100644",
            },
            { path: "gone.js", added: 0, deleted: 1, previousOid: oid("c") },
          ],
        },
      ],
      [{ path: "head.ts", oid: oid("d"), mode: "100644" }],
    );

    expect(blobs).toStrictEqual([
      { path: "a.ts", oid: oid("b"), mode: "100644" },
      { path: "a.ts", oid: oid("a"), mode: "120000" },
      { path: "copy.ts", oid: oid("b"), mode: "100644" },
      { path: "gone.js", oid: oid("c") },
      { path: "head.ts", oid: oid("d"), mode: "100644" },
    ]);
  });

  it("leaves out declaration files and files that are not scripts", () => {
    const blobs = blobsOfHistory(
      [
        {
          changes: [
            { path: "api.d.ts", added: 1, deleted: 0, oid: oid("a") },
            { path: "README.md", added: 1, deleted: 0, oid: oid("b") },
          ],
        },
      ],
      [],
    );

    expect(blobs).toStrictEqual([]);
  });
});
