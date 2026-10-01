import { assert, describe, it } from "@effect/vitest";
import { Schema } from "effect";

import { InspectResult } from "./inspect-result.js";

const decode = Schema.decodeUnknownSync(InspectResult);

const result = {
  schemaVersion: 1,
  shallow: false,
  window: {
    since: "2026-01-01T00:00:00.000Z",
    until: "2026-09-30T10:15:00.000Z",
    commits: 32,
  },
  matches: [
    {
      pattern: "packages/auth",
      files: 19,
      truckFactor: 1,
      island: true,
      orphaned: false,
      experts: [
        {
          name: "Jonas Weber",
          email: "jonas.weber@aurora.example",
          active: true,
          lastCommitAt: "2026-06-20T13:10:03.000Z",
          files: 18,
          soleFiles: 17,
          share: 0.9474,
        },
      ],
      commits: 32,
      lastCommitAt: "2026-06-20T13:10:03.000Z",
      automation: { human: 18, agentAssisted: 13, agent: 1, bot: 0 },
      reasons: ["Jonas Weber is the only expert on 17 of 19 files"],
    },
  ],
  unmatched: ["packages/missing"],
};

describe("InspectResult", () => {
  it("decodes an entry with its experts, automation and unmatched arguments", () => {
    const decoded = decode(result);

    assert.strictEqual(decoded.matches[0]?.experts[0]?.soleFiles, 17);
    assert.deepStrictEqual(decoded.unmatched, ["packages/missing"]);
  });

  it("decodes an entry without commits in the window", () => {
    const [entry] = result.matches;
    const quiet = { ...entry, commits: 0, lastCommitAt: null };

    assert.strictEqual(
      decode({ ...result, matches: [quiet] }).matches[0]?.lastCommitAt,
      null,
    );
  });

  it("rejects a result without unmatched", () => {
    const { unmatched: _removed, ...incomplete } = result;

    assert.throws(() => {
      decode(incomplete);
    }, /unmatched/u);
  });
});
