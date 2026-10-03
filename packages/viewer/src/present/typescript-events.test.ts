import { describe, expect, it } from "vitest";

import { sampleBlock } from "../testing/reports.js";
import { eventRows } from "./typescript-events.js";

type Event = ReturnType<typeof sampleBlock<"trends">>["events"][number];

const event = (overrides: Partial<Event> = {}): Event => ({
  date: "2024-03-02",
  path: "tsconfig.json",
  flag: "strict",
  from: false,
  to: true,
  ...overrides,
});

describe("eventRows", () => {
  it("words the flag changes of the sample", () => {
    expect(eventRows(sampleBlock("trends").events)).toEqual([
      {
        date: "11 Feb 2026",
        flag: "strict",
        change: "turned on",
        on: true,
        configs: "tsconfig.json",
        paths: "tsconfig.json",
      },
    ]);
  });

  it("tells a flag turned off, a config created with it on and one created with it off", () => {
    const rows = eventRows([
      event({ from: null, to: true }),
      event({ date: "2024-04-01", from: null, to: false }),
      event({ date: "2024-05-01", from: true, to: false }),
    ]);

    expect(rows.map(({ change, on }) => [change, on])).toEqual([
      ["turned off", false],
      ["created with it off", false],
      ["created with it on", true],
    ]);
  });

  it("lists the newest change first", () => {
    const rows = eventRows([
      event({ date: "2023-01-01" }),
      event({ date: "2025-01-01" }),
    ]);

    expect(rows.map(({ date }) => date)).toEqual(["1 Jan 2025", "1 Jan 2023"]);
  });

  it("joins the configs that changed the same flag the same way on the same day", () => {
    const rows = eventRows([
      event({ path: "tsconfig.json" }),
      event({ path: "packages/a/tsconfig.json" }),
      event({ path: "packages/b/tsconfig.json" }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      configs: "tsconfig.json and 2 more configs",
      paths:
        "tsconfig.json, packages/a/tsconfig.json, packages/b/tsconfig.json",
    });
  });

  it("keeps two flags of the same config apart", () => {
    const rows = eventRows([
      event(),
      event({ flag: "noUncheckedIndexedAccess" }),
    ]);

    expect(rows.map(({ flag }) => flag)).toEqual([
      "noUncheckedIndexedAccess",
      "strict",
    ]);
  });

  it("has no row without an event", () => {
    expect(eventRows([])).toEqual([]);
  });
});
