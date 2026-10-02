// Owns the stories that restate the knowledge section: truck-factor alert, orphaned knowledge and quiet territory.
// Separate from the other families because it reads the territories and the truck factor rather than the commits alone.
// Cost: one pass over the commits and the files of the territories.

import { DateTime } from "effect";

import { isoDateOfDay, localDayOf } from "../activity/buckets.js";
import { monthsBetween } from "../activity/calendar.js";
import { isContributorCommit } from "../automation/classify.js";
import { territoryNameOf, countOf, nounOf } from "../report/sentences.js";
import type { Story } from "../report/stories.js";
import type { StoryTerritory, StoryFacts } from "./stories.js";
import { STORY_THRESHOLDS } from "./thresholds.js";

const { quietTerritoryMonths } = STORY_THRESHOLDS;

const truckFactorAlert = ({
  commits,
  knowledge: { files, truckFactor },
}: StoryFacts): ReadonlyArray<Story> => {
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

const bySizeThenPath = (a: StoryTerritory, b: StoryTerritory): number =>
  b.paths.length - a.paths.length || a.path.localeCompare(b.path);

const orphanedKnowledge = (
  territories: ReadonlyArray<StoryTerritory>,
): ReadonlyArray<Story> => {
  const [largest] = territories
    .filter(({ kind, orphaned }) => kind !== "other" && orphaned)
    .toSorted(bySizeThenPath);
  return largest === undefined
    ? []
    : [
        {
          kind: "orphaned-knowledge",
          title: "Orphaned knowledge",
          detail: `${countOf(largest.withoutActiveExpert)} of ${nounOf(largest.paths.length, "file")} in ${territoryNameOf(largest.path)} have no active expert.`,
          value: largest.withoutActiveExpert,
          path: largest.path,
        },
      ];
};

const quietTerritory = (
  territories: ReadonlyArray<StoryTerritory>,
  { now }: StoryFacts,
): ReadonlyArray<Story> => {
  const nowSeconds = DateTime.toEpochMillis(now) / 1000;
  const [quietest] = territories
    .flatMap(({ kind, path, lastChangeTime }) =>
      kind === "other" || lastChangeTime === undefined
        ? []
        : [{ path, last: lastChangeTime }],
    )
    .filter(
      ({ last }) => monthsBetween(last, nowSeconds) >= quietTerritoryMonths,
    )
    .toSorted((a, b) => a.last - b.last || a.path.localeCompare(b.path));
  if (quietest === undefined) {
    return [];
  }
  const { path, last } = quietest;
  const date = isoDateOfDay(localDayOf(last, 0));
  return [
    {
      kind: "quiet-territory",
      title: "Quiet corner",
      detail: `${territoryNameOf(path, true)} has not changed since ${date}.`,
      value: monthsBetween(last, nowSeconds),
      date,
      path,
    },
  ];
};

/**
 * The `quiet-territory`, `truck-factor-alert` and `orphaned-knowledge` findings
 * that pass their thresholds. The quiet territory is the one untouched longest, at
 * least `quietTerritoryMonths`; the alert needs a repository truck factor of 1 with
 * more than one contributor; the orphaned territory is the largest one flagged
 * orphaned. Territories are those of the recommended detail; `other` territories are never
 * named, and without territories only the alert can appear.
 */
export const knowledgeStories = (facts: StoryFacts): ReadonlyArray<Story> => {
  const territories = facts.territories ?? [];
  return [
    ...truckFactorAlert(facts),
    ...orphanedKnowledge(territories),
    ...quietTerritory(territories, facts),
  ];
};
