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
