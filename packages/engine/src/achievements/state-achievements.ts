// Owns the achievements that hold today and can be lost: bus-proof, test culture and fresh blood.
// They have no day: yesterday's truck factor says nothing about today's. A shallow clone withholds the two that need the full history.

import type { DateTime } from "effect";

import { isNewContributor } from "../contributors/status.js";
import type { Achievement } from "../report/achievements.js";
import type { CodeStats } from "../report/code-stats.js";
import { nounOf } from "../report/sentences.js";
import { ACHIEVEMENT_THRESHOLDS } from "./thresholds.js";

const {
  busProofTruckFactor,
  testCultureShare,
  freshBloodPeople,
  freshBloodDays,
} = ACHIEVEMENT_THRESHOLDS;

const WITHHELD_DETAIL = "Needs the full history, and this clone is shallow.";

const state = (
  achievement: Pick<Achievement, "kind" | "title" | "reached" | "detail"> & {
    readonly progress: Achievement["progress"];
  },
): Achievement => ({ ...achievement, reachedAt: null, holds: "state" });

const withheld = (kind: Achievement["kind"], title: string): Achievement =>
  state({
    kind,
    title,
    reached: false,
    detail: WITHHELD_DETAIL,
    progress: null,
  });

/** `bus-proof`: a truck factor of at least `busProofTruckFactor`; withheld in a shallow clone. */
export const busProof = (
  truckFactor: number,
  shallow: boolean,
): Achievement => {
  if (shallow) {
    return withheld("bus-proof", "Bus-proof");
  }
  const reached = truckFactor >= busProofTruckFactor;
  return state({
    kind: "bus-proof",
    title: "Bus-proof",
    reached,
    detail:
      truckFactor === 0
        ? "No file has an expert."
        : `Truck factor ${truckFactor}: ${nounOf(truckFactor, "person", "people")} must leave before more than half of the files lose every expert.`,
    progress: reached
      ? null
      : {
          value: truckFactor,
          target: busProofTruckFactor,
          unit: "truck factor",
        },
  });
};

/**
 * `test-culture`: at least `testCultureShare` of the universe files are tests.
 * A locked share is shown rounded down, so it never reads as the threshold it misses.
 */
export const testCulture = ({
  files,
  tests,
}: Pick<CodeStats, "files" | "tests">): Achievement => {
  const percent = files === 0 ? 0 : (tests.files * 100) / files;
  const reached = files > 0 && tests.files / files >= testCultureShare;
  return state({
    kind: "test-culture",
    title: "Test culture",
    reached,
    detail:
      files === 0
        ? "No code files."
        : `${tests.files} of ${nounOf(files, "file")} are tests (${reached ? Math.round(percent) : Math.floor(percent)}%).`,
    progress: reached
      ? null
      : {
          value: Math.floor(percent),
          target: Math.round(testCultureShare * 100),
          unit: "% test files",
        },
  });
};

/** `fresh-blood`: at least `freshBloodPeople` people made their first commit in the last `freshBloodDays` days, as `isNewContributor` counts them; withheld in a shallow clone. */
export const freshBlood = (
  contributorStarts: ReadonlyArray<number>,
  now: DateTime.Utc,
  shallow: boolean,
): Achievement => {
  if (shallow) {
    return withheld("fresh-blood", "Fresh blood");
  }
  const newcomers = contributorStarts.filter((start) =>
    isNewContributor(start, contributorStarts[0], now),
  ).length;
  const reached = newcomers >= freshBloodPeople;
  return state({
    kind: "fresh-blood",
    title: "Fresh blood",
    reached,
    detail: reached
      ? `${nounOf(newcomers, "person", "people")} made their first commit in the last ${freshBloodDays} days.`
      : `${nounOf(newcomers, "newcomer")} in the last ${freshBloodDays} days.`,
    progress: reached
      ? null
      : {
          value: newcomers,
          target: freshBloodPeople,
          unit: `newcomers in ${freshBloodDays} days`,
        },
  });
};
