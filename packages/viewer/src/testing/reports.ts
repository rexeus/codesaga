import type { Report } from "@codesaga/engine";

import sample from "../../../../fixtures/report.sample.json" with { type: "json" };
import { parseReport } from "../document/embedded-report.js";

/** The hand-written three-year report of `fixtures/report.sample.json`. */
export const sampleReport = (): Report => parseReport(JSON.stringify(sample));

type DeepDive = NonNullable<NonNullable<Report["deepDives"]>["typescript"]>;

/** The TypeScript deep dive of the sample report, which every block of the section has data in. */
export const sampleDeepDive = (): DeepDive => {
  const deepDive = sampleReport().deepDives?.typescript;
  if (deepDive === undefined) {
    throw new TypeError("The sample report has no TypeScript deep dive.");
  }
  return deepDive;
};

/** One block of the sample's deep dive, which the sample has. */
export const sampleBlock = <Key extends Exclude<keyof DeepDive, "coverage">>(
  key: Key,
): NonNullable<DeepDive[Key]> => {
  const block = sampleDeepDive()[key];
  if (block === undefined) {
    throw new TypeError(`The sample's deep dive has no ${key} block.`);
  }
  return block;
};

/** The first element of a list the test knows to have one. */
export const firstOf = <Item>(list: readonly Item[]): Item => {
  const [first] = list;
  if (first === undefined) {
    throw new TypeError("The list is empty.");
  }
  return first;
};
