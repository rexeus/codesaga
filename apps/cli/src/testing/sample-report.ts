// The committed sample report, decoded with the engine's schema, for renderer tests.
import { readFileSync } from "node:fs";

import { Report } from "@codesaga/engine";
import { Array as Arr, Schema } from "effect";

const sampleUrl = new URL(
  "../../../../fixtures/report.sample.json",
  import.meta.url,
);

/** `fixtures/report.sample.json`: 8 contributors, 5 automation tools, 156 weeks. */
export const sampleReport = (): Report =>
  Schema.decodeUnknownSync(Report)(JSON.parse(readFileSync(sampleUrl, "utf8")));

type Areas = Report["knowledge"]["areas"];

/** `report` with `change` applied to the areas of every level; `totalAreas` stays as it is. */
export const mapAreas = (
  report: Report,
  change: (
    areas: Areas["levels"][number]["areas"],
  ) => Areas["levels"][number]["areas"],
): Report => ({
  ...report,
  knowledge: {
    ...report.knowledge,
    areas: {
      ...report.knowledge.areas,
      levels: Arr.map(report.knowledge.areas.levels, (level) => ({
        ...level,
        areas: change(level.areas),
      })),
    },
  },
});
