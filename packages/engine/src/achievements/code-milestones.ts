// Owns the milestones about the code and how it changed: languages, an unbroken streak and a spring cleaning.
// Each is reached once and stays reached, with the day it was first passed.

import { isoDateOfDay } from "../activity/buckets.js";
import type { Achievement } from "../report/achievements.js";
import { countOf, nounOf, quotedSubject } from "../report/sentences.js";
import type { HistoryFacts } from "./history-facts.js";
import { significantLanguages } from "./polyglot-history.js";
import type { LanguageLines } from "./polyglot-history.js";
import { detailOf, reachedOn } from "./reached-on.js";
import { ACHIEVEMENT_THRESHOLDS } from "./thresholds.js";

const { polyglotLanguages, unbrokenDays, springCleaningNetLines } =
  ACHIEVEMENT_THRESHOLDS;

const MAX_LANGUAGES_NAMED = 5;

const languagesSentence = (names: ReadonlyArray<string>): string => {
  const named = names.slice(0, MAX_LANGUAGES_NAMED).join(", ");
  const more = names.length - MAX_LANGUAGES_NAMED;
  return more > 0 ? `${named} and ${countOf(more)} more` : named;
};

/**
 * `polyglot`: languages with a share of the code lines. It is reached when the
 * files at HEAD show it or the history once did; the day falls back to
 * the last commit when only HEAD shows it. `languages` are today's, most lines first.
 */
export const polyglot = (
  {
    polyglotTime,
    commitTimes,
  }: Pick<HistoryFacts, "polyglotTime" | "commitTimes">,
  languages: ReadonlyArray<LanguageLines>,
  shallow: boolean,
): Achievement => {
  const today = significantLanguages(languages).map(({ name }) => name);
  const reached =
    today.length >= polyglotLanguages || polyglotTime !== undefined;
  const now = `${nounOf(today.length, "language")}${today.length === 0 ? "" : `: ${languagesSentence(today)}`}.`;
  return {
    kind: "polyglot",
    title: "Polyglot",
    reached,
    reachedAt: reachedOn(
      shallow,
      reached ? (polyglotTime ?? commitTimes.at(-1)) : undefined,
    ),
    holds: "milestone",
    detail:
      reached && today.length < polyglotLanguages
        ? `Passed in the past; ${now}`
        : now,
    progress: reached
      ? null
      : { value: today.length, target: polyglotLanguages, unit: "languages" },
  };
};

/** `unbroken`: a commit on each of `unbrokenDays` consecutive days; the day is the author's local one. */
export const unbroken = (
  {
    longestStreak,
    streakCompletedDay,
  }: Pick<HistoryFacts, "longestStreak" | "streakCompletedDay">,
  shallow: boolean,
): Achievement => ({
  kind: "unbroken",
  title: "Unbroken",
  reached: longestStreak >= unbrokenDays,
  reachedAt:
    shallow || streakCompletedDay === undefined
      ? null
      : isoDateOfDay(streakCompletedDay),
  holds: "milestone",
  detail: detailOf(
    shallow,
    `Longest streak: ${nounOf(longestStreak, "day")} with a commit every day.`,
  ),
  progress:
    longestStreak >= unbrokenDays
      ? null
      : { value: longestStreak, target: unbrokenDays, unit: "days in a row" },
});

/** `spring-cleaning`: one commit that removed `springCleaningNetLines` more code lines than it added. */
export const springCleaning = (
  { cleanup }: Pick<HistoryFacts, "cleanup">,
  shallow: boolean,
): Achievement => {
  const reached = cleanup.removed >= springCleaningNetLines;
  const subject =
    cleanup.subject === "" ? "" : `: ${quotedSubject(cleanup.subject)}`;
  return {
    kind: "spring-cleaning",
    title: "Spring cleaning",
    reached,
    reachedAt: reachedOn(shallow, cleanup.firstPassTime),
    holds: "milestone",
    detail: detailOf(
      shallow,
      cleanup.removed === 0
        ? "No commit has removed more code lines than it added."
        : `One commit removed ${countOf(cleanup.removed)} more code lines than it added${subject}.`,
    ),
    progress: reached
      ? null
      : {
          value: cleanup.removed,
          target: springCleaningNetLines,
          unit: "net lines removed",
        },
  };
};
