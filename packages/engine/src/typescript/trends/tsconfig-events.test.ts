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

describe("flagEventsOf", () => {
  it("reports a strict flip with the date of the commit that made it", () => {
    const events = flagEventsOf({
      commits: [
        { time: at("2024-01-05"), changes: [change("tsconfig.json", "a")] },
        {
          time: at("2024-03-11"),
          changes: [change("tsconfig.json", "b", "a")],
        },
      ],
      texts: new Map([
        ["a", config({ strict: false })],
        ["b", config({ strict: true })],
      ]),
    });

    expect(events).toStrictEqual([
      {
        date: "2024-03-11",
        path: "tsconfig.json",
        flag: "strict",
        from: false,
        to: true,
      },
    ]);
  });

  it("reports the first config that sets a flag on as created with it, and no config that leaves it off", () => {
    const events = flagEventsOf({
      commits: [
        { time: at("2024-01-05"), changes: [change("tsconfig.json", "a")] },
        { time: at("2024-02-05"), changes: [change("pkg/tsconfig.json", "b")] },
        { time: at("2024-03-05"), changes: [change("lib/tsconfig.json", "c")] },
      ],
      texts: new Map([
        ["a", config({ strict: true, noUncheckedIndexedAccess: false })],
        ["b", config({ strict: true })],
        ["c", config({})],
      ]),
    });

    expect(events).toStrictEqual([
      {
        date: "2024-01-05",
        path: "tsconfig.json",
        flag: "strict",
        from: null,
        to: true,
      },
    ]);
  });
});

describe("flagEventsOf over extends and presets", () => {
  it("shows a base config's flip on the config that extends it", () => {
    const events = flagEventsOf({
      commits: [
        {
          time: at("2024-01-05"),
          changes: [
            change("tsconfig.base.json", "base1"),
            change("pkg/tsconfig.json", "child"),
          ],
        },
        {
          time: at("2024-05-20"),
          changes: [change("tsconfig.base.json", "base2", "base1")],
        },
      ],
      texts: new Map([
        ["base1", config({ noUncheckedIndexedAccess: false })],
        ["base2", config({ noUncheckedIndexedAccess: true })],
        ["child", config({}, "../tsconfig.base")],
      ]),
    });

    expect(
      events.map(({ path, flag, from, to, date }) => [
        path,
        flag,
        from,
        to,
        date,
      ]),
    ).toStrictEqual([
      [
        "pkg/tsconfig.json",
        "noUncheckedIndexedAccess",
        false,
        true,
        "2024-05-20",
      ],
      [
        "tsconfig.base.json",
        "noUncheckedIndexedAccess",
        false,
        true,
        "2024-05-20",
      ],
    ]);
  });
});

describe("flagEventsOf over a key that is no longer set", () => {
  it("reports no turning off when a config stops setting strict", () => {
    const events = flagEventsOf({
      commits: [
        { time: at("2024-01-05"), changes: [change("tsconfig.json", "set")] },
        {
          time: at("2026-07-28"),
          changes: [change("tsconfig.json", "unset", "set")],
        },
      ],
      texts: new Map([
        ["set", config({ strict: true })],
        ["unset", config({ target: "es2022" })],
      ]),
    });

    expect(events.map(({ date, from, to }) => [date, from, to])).toStrictEqual([
      ["2024-01-05", null, true],
    ]);
  });

  it("reports no turning off when a root becomes a solution-style config of references", () => {
    const solution = JSON.stringify({
      files: [],
      references: [{ path: "./tsconfig.src.json" }],
    });

    const events = flagEventsOf({
      commits: [
        { time: at("2024-01-05"), changes: [change("tsconfig.json", "set")] },
        {
          time: at("2026-07-28"),
          changes: [
            change("tsconfig.json", "solution", "set"),
            change("tsconfig.src.json", "src"),
          ],
        },
      ],
      texts: new Map([
        ["set", config({ strict: true })],
        ["solution", solution],
        ["src", config({ strict: true })],
      ]),
    });

    expect(events.map(({ path, date }) => [path, date])).toStrictEqual([
      ["tsconfig.json", "2024-01-05"],
    ]);
  });
});

describe("flagEventsOf between two written values", () => {
  it("still reports a flip between two written values", () => {
    const events = flagEventsOf({
      commits: [
        { time: at("2024-01-05"), changes: [change("tsconfig.json", "on")] },
        {
          time: at("2025-01-05"),
          changes: [change("tsconfig.json", "off", "on")],
        },
      ],
      texts: new Map([
        ["on", config({ strict: true })],
        ["off", config({ strict: false })],
      ]),
    });

    expect(events.map(({ from, to }) => [from, to])).toStrictEqual([
      [null, true],
      [true, false],
    ]);
  });
});

describe("flagEventsOf over a package preset", () => {
  it("does not report a flag that an extended package preset may decide", () => {
    const events = flagEventsOf({
      commits: [
        { time: at("2024-01-05"), changes: [change("tsconfig.json", "a")] },
        {
          time: at("2024-02-05"),
          changes: [change("tsconfig.json", "b", "a")],
        },
      ],
      texts: new Map([
        ["a", config({}, "@tsconfig/node20/tsconfig.json")],
        ["b", config({ target: "es2022" }, "@tsconfig/node20/tsconfig.json")],
      ]),
    });

    expect(events).toStrictEqual([]);
  });
});

describe("flagEventsOf over a renamed base config", () => {
  it("resolves an extends against the files of its own time, so a base renamed with its child updated flips both under their new names", () => {
    const events = flagEventsOf({
      commits: [
        {
          time: at("2024-01-05"),
          changes: [
            change("tsconfig.base.json", "base"),
            change("pkg/tsconfig.json", "old-child"),
          ],
        },
        {
          // The base is renamed and the child follows it in the same commit.
          time: at("2024-02-05"),
          changes: [
            change("tsconfig.base.json", undefined, "base"),
            change("tsconfig.shared.json", "base"),
            change("pkg/tsconfig.json", "new-child", "old-child"),
          ],
        },
        {
          time: at("2024-03-05"),
          changes: [change("tsconfig.shared.json", "strict", "base")],
        },
      ],
      texts: new Map([
        ["base", config({ strict: false })],
        ["strict", config({ strict: true })],
        ["old-child", config({}, "../tsconfig.base")],
        ["new-child", config({}, "../tsconfig.shared")],
      ]),
    });

    expect(
      events.map(({ path, date, from, to }) => [path, date, from, to]),
    ).toStrictEqual([
      ["pkg/tsconfig.json", "2024-03-05", false, true],
      ["tsconfig.shared.json", "2024-03-05", false, true],
    ]);
  });
});

describe("flagEventsOf over many flips", () => {
  it("returns every event and leaves the cut to the report", () => {
    const flips = Array.from({ length: 30 }, (_, index) => ({
      time: at("2024-01-01") + index * 86_400,
      changes: [change("tsconfig.json", `v${index + 1}`, `v${index}`)],
    }));
    const texts = new Map(
      Array.from({ length: 31 }, (_, index) => [
        `v${index}`,
        config({ strict: index % 2 === 1 }),
      ]),
    );

    const events = flagEventsOf({ commits: flips, texts });

    expect(events).toHaveLength(30);
    expect(events.at(-1)?.date).toBe("2024-01-30");
  });
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
