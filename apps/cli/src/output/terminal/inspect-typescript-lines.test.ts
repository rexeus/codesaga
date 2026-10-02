import type { InspectResult } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { renderInspect } from "./inspect-view.js";
import { makeStyle } from "./style.js";

const plain = makeStyle(false);

type Entry = InspectResult["matches"][number];
type TypeScript = NonNullable<Entry["typescript"]>;

const typescript: TypeScript = {
  files: 3,
  unparsed: 1,
  maxComplexity: 41,
  complexFunctions: 2,
  hardest: [
    {
      name: "reconcile",
      path: "src/billing/reconcile.ts",
      line: 88,
      complexity: 41,
    },
    { name: "build", path: "src/query/build.ts", line: 31, complexity: 33 },
  ],
  escapes: 12,
  directives: 1,
  importedBy: {
    files: 7,
    top: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"],
  },
  testedBy: { files: 0, top: [] },
  strict: true,
};

const resultWith = (code: TypeScript | undefined): InspectResult => ({
  schemaVersion: 1,
  shallow: false,
  window: {
    since: "2025-01-01T00:00:00.000Z",
    until: "2026-09-30T10:00:00.000Z",
    commits: 0,
  },
  matches: [
    {
      pattern: "src",
      files: 3,
      truckFactor: 0,
      island: false,
      orphaned: false,
      experts: [],
      commits: 0,
      lastCommitAt: null,
      automation: { human: 0, agentAssisted: 0, agent: 0, bot: 0 },
      reasons: [],
      ...(code === undefined ? {} : { typescript: code }),
    },
  ],
  unmatched: [],
});

describe("renderInspect TypeScript figures", () => {
  it("lists the figures, the hardest functions and who imports and tests the files", () => {
    expect(
      renderInspect(resultWith(typescript), plain).split("\n"),
    ).toStrictEqual([
      "2025-01-01 to 2026-09-30",
      "",
      "src",
      "3 files · truck factor 0",
      "No expert found.",
      "No commits in the window.",
      "3 TypeScript or JavaScript files · 1 not parsed · hardest function 41 · 2 at 15 or more · 12 escape hatches · 1 @ts directive · strict true",
      "  41 reconcile at src/billing/reconcile.ts:88",
      "  33 build at src/query/build.ts:31",
      "imported by 7 files: src/a.ts, src/b.ts, src/c.ts, src/d.ts, src/e.ts and 2 more",
      "tested by no file",
    ]);
  });

  it("prints nothing for an entry without TypeScript figures", () => {
    expect(renderInspect(resultWith(undefined), plain)).not.toContain(
      "TypeScript",
    );
  });

  it("escapes the paths and function names", () => {
    const hostile: TypeScript = {
      ...typescript,
      hardest: [
        {
          name: "\u001B[2Jevil",
          path: "a\u001B[31m.ts",
          line: 1,
          complexity: 20,
        },
      ],
      importedBy: { files: 1, top: ["b\u001B[1m.ts"] },
    };

    const text = renderInspect(resultWith(hostile), plain);

    expect(text).not.toContain("\u001B");
    expect(text).toContain("\\u001b[2Jevil at a\\u001b[31m.ts:1");
    expect(text).toContain("imported by 1 file: b\\u001b[1m.ts");
  });
});
