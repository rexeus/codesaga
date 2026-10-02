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

type Territories = Report["knowledge"]["territories"];

/** `report` with `change` applied to the territories of every detail; `totalTerritories` stays as it is. */
export const mapTerritories = (
  report: Report,
  change: (
    territories: Territories["details"][number]["territories"],
  ) => Territories["details"][number]["territories"],
): Report => ({
  ...report,
  knowledge: {
    ...report.knowledge,
    territories: {
      ...report.knowledge.territories,
      details: Arr.map(report.knowledge.territories.details, (detail) => ({
        ...detail,
        territories: change(detail.territories),
      })),
    },
  },
});
