import { describe, expect, it } from "vitest";

import type { FileChange } from "../../history/history.js";
import { flagEventsOf } from "./tsconfig-events.js";

const at = (day: string) => Date.parse(`${day}T12:00:00Z`) / 1000;
const change = (
  path: string,
  oid: string | undefined,
  previousOid?: string,
): FileChange => ({
  path,
  added: 0,
  deleted: 0,
  ...(oid === undefined ? {} : { oid }),
  ...(previousOid === undefined ? {} : { previousOid }),
});
const config = (options: Record<string, unknown>, base?: string) =>
  JSON.stringify({
    ...(base === undefined ? {} : { extends: base }),
    compilerOptions: options,
  });

describe("flagEventsOf over absorbed histories", () => {
  it("reports a flip in an absorbed history before the chain begins, and nothing for the same config when the merge takes it in", () => {
    const events = flagEventsOf({
      commits: [
        {
          time: at("2023-01-05"),
          line: 1,
          changes: [change("lib/tsconfig.json", "a")],
        },
        {
          time: at("2023-02-05"),
          line: 1,
          changes: [change("lib/tsconfig.json", "b", "a")],
        },
        { time: at("2023-03-01"), changes: [change("tsconfig.json", "b")] },
        {
          time: at("2023-03-02"),
          absorbs: [1],
          changes: [change("lib/tsconfig.json", "b")],
        },
      ],
      texts: new Map([
        ["a", config({ strict: false })],
        ["b", config({ strict: true })],
      ]),
    });

    expect(events).toStrictEqual([
      {
        date: "2023-02-05",
        path: "lib/tsconfig.json",
        flag: "strict",
        from: false,
        to: true,
      },
      {
        date: "2023-03-01",
        path: "tsconfig.json",
        flag: "strict",
        from: null,
        to: true,
      },
    ]);
  });
});

describe("flagEventsOf over configs of the same path in two histories", () => {
  it("follows an extends within the history that holds the config, not through a config of the same path in another", () => {
    const events = flagEventsOf({
      commits: [
        {
          time: at("2023-01-05"),
          changes: [
            change("tsconfig.base.json", "off"),
            change("tsconfig.json", "child"),
          ],
        },
        {
          time: at("2023-01-06"),
          line: 1,
          changes: [
            change("tsconfig.base.json", "on"),
            change("tsconfig.json", "child"),
          ],
        },
        {
          time: at("2023-01-07"),
          changes: [change("tsconfig.base.json", "strict-off", "off")],
        },
      ],
      texts: new Map([
        ["off", config({ strict: false })],
        ["strict-off", config({ strict: true })],
        ["on", config({ strict: true })],
        ["child", config({}, "./tsconfig.base.json")],
      ]),
    });

    expect(
      events.map(({ date, path, from, to }) => [date, path, from, to]),
    ).toStrictEqual([
      ["2023-01-06", "tsconfig.base.json", null, true],
      ["2023-01-06", "tsconfig.json", null, true],
      ["2023-01-07", "tsconfig.base.json", false, true],
      ["2023-01-07", "tsconfig.json", false, true],
    ]);
  });
});

describe("flagEventsOf over a strict config in an old history", () => {
  it("still reports a config of the chain that was created strict, as the first of its own history to switch it on", () => {
    const events = flagEventsOf({
      commits: [
        {
          time: at("2021-01-05"),
          line: 1,
          changes: [change("legacy/tsconfig.json", "on")],
        },
        { time: at("2023-12-27"), changes: [change("tsconfig.json", "on")] },
        {
          time: at("2023-12-28"),
          absorbs: [1],
          changes: [change("legacy/tsconfig.json", "on")],
        },
      ],
      texts: new Map([["on", config({ strict: true })]]),
    });

    expect(
      events.map(({ date, path, from }) => [date, path, from]),
    ).toStrictEqual([
      ["2021-01-05", "legacy/tsconfig.json", null],
      ["2023-12-27", "tsconfig.json", null],
    ]);
  });
});
