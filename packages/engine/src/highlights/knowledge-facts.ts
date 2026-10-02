// Owns the highlights that restate the knowledge section: truck-factor alert, orphaned knowledge and quiet area.
// Separate from the other families because it reads the areas and the truck factor rather than the commits alone.
// Cost: one pass over the commits and the files of the areas.

import { DateTime } from "effect";

import { isoDateOfDay, localDayOf } from "../activity/buckets.js";
import { monthsBetween } from "../activity/calendar.js";
import { isContributorCommit } from "../automation/classify.js";
import type { Highlight } from "../report/highlights.js";
import { countOf, nounOf } from "../report/sentences.js";
import type { HighlightArea, HighlightFacts } from "./highlights.js";
import { HIGHLIGHT_THRESHOLDS } from "./thresholds.js";

const { quietAreaMonths } = HIGHLIGHT_THRESHOLDS;

const truckFactorAlert = ({
  commits,
  knowledge: { files, truckFactor },
}: HighlightFacts): ReadonlyArray<Highlight> => {
  const contributors = new Set(
    commits
      .filter((commit) => isContributorCommit(commit))
      .map(({ author }) => author.email),
  );
  const [person] = truckFactor.people;
  if (
    truckFactor.value !== 1 ||
    person === undefined ||
    contributors.size < 2
  ) {
    return [];
  }
  return [
    {
      kind: "truck-factor-alert",
      title: "Truck factor 1",
      detail: `If ${person.name} left, more than half of the ${nounOf(files, "file")} would have no expert.`,
      value: 1,
      people: [{ name: person.name, email: person.email }],
    },
  ];
};

const bySizeThenPath = (a: HighlightArea, b: HighlightArea): number =>
  b.paths.length - a.paths.length || a.path.localeCompare(b.path);

const orphanedKnowledge = (
  areas: ReadonlyArray<HighlightArea>,
): ReadonlyArray<Highlight> => {
  const [largest] = areas
    .filter(({ kind, orphaned }) => kind !== "rest" && orphaned)
    .toSorted(bySizeThenPath);
  return largest === undefined
    ? []
    : [
        {
          kind: "orphaned-knowledge",
          title: "Orphaned knowledge",
          detail: `${countOf(largest.withoutActiveExpert)} of ${nounOf(largest.paths.length, "file")} in ${largest.path} have no active expert.`,
          value: largest.withoutActiveExpert,
          path: largest.path,
        },
      ];
};

const quietArea = (
  areas: ReadonlyArray<HighlightArea>,
  { now }: HighlightFacts,
): ReadonlyArray<Highlight> => {
  const nowSeconds = DateTime.toEpochMillis(now) / 1000;
  const [quietest] = areas
    .flatMap(({ kind, path, lastChangeTime }) =>
      kind === "rest" || lastChangeTime === undefined
        ? []
        : [{ path, last: lastChangeTime }],
    )
    .filter(({ last }) => monthsBetween(last, nowSeconds) >= quietAreaMonths)
    .toSorted((a, b) => a.last - b.last || a.path.localeCompare(b.path));
  if (quietest === undefined) {
    return [];
  }
  const { path, last } = quietest;
  const date = isoDateOfDay(localDayOf(last, 0));
  return [
    {
      kind: "quiet-area",
      title: "Quiet corner",
      detail: `${path} has not changed since ${date}.`,
      value: monthsBetween(last, nowSeconds),
      date,
      path,
    },
  ];
};

/**
 * The `quiet-area`, `truck-factor-alert` and `orphaned-knowledge` findings
 * that pass their thresholds. The quiet area is the one untouched longest, at
 * least `quietAreaMonths`; the alert needs a repository truck factor of 1 with
 * more than one contributor; the orphaned area is the largest one flagged
 * orphaned. Areas are those of the recommended level; `rest` areas are never
 * named, and without areas only the alert can appear.
 */
export const knowledgeHighlights = (
  facts: HighlightFacts,
): ReadonlyArray<Highlight> => {
  const areas = facts.areas ?? [];
  return [
    ...truckFactorAlert(facts),
    ...orphanedKnowledge(areas),
    ...quietArea(areas, facts),
  ];
};
