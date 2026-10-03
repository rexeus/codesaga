import { describe, expect, it } from "vitest";

import { blobsOfChanges } from "./history-blobs.js";

const oid = (digit: string) => digit.repeat(40);

describe("blobsOfChanges", () => {
  it("names each blob under every path it was met under, before and after a change, with the mode of that version", () => {
    const blobs = blobsOfChanges([
      {
        path: "a.ts",
        oid: oid("b"),
        previousOid: oid("a"),
        mode: "100644",
        previousMode: "120000",
      },
      { path: "copy.ts", oid: oid("b"), mode: "100644" },
      { path: "gone.js", previousOid: oid("c") },
      { path: "head.ts", oid: oid("d"), mode: "100644" },
    ]);

    expect(blobs).toStrictEqual([
      { path: "a.ts", oid: oid("b"), mode: "100644" },
      { path: "a.ts", oid: oid("a"), mode: "120000" },
      { path: "copy.ts", oid: oid("b"), mode: "100644" },
      { path: "gone.js", oid: oid("c") },
      { path: "head.ts", oid: oid("d"), mode: "100644" },
    ]);
  });

  it("leaves out declaration files and files that are not scripts", () => {
    const blobs = blobsOfChanges([
      { path: "api.d.ts", oid: oid("a") },
      { path: "README.md", oid: oid("b") },
    ]);

    expect(blobs).toStrictEqual([]);
  });
});
