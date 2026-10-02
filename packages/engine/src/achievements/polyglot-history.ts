// Owns telling which languages carry the code: today from the file counts, and in the past from the lines each commit changed.
// The past is an estimate: the net lines per language over every path that counted as code, deleted files included.
// Cost: one pass over the commits' changes, and a pass over the languages after each commit that changed code.

import type { ClassifiedCommit } from "../automation/classify.js";
import { languageNameOf } from "../universe/languages.js";
import { ACHIEVEMENT_THRESHOLDS } from "./thresholds.js";

const { polyglotLanguages, polyglotMinShare } = ACHIEVEMENT_THRESHOLDS;

/** A language and its code lines. */
export type LanguageLines = {
  readonly name: string;
  readonly lines: number;
};

/** The languages with at least `polyglotMinShare` of the code lines, in the order given. */
export const significantLanguages = (
  languages: ReadonlyArray<LanguageLines>,
): ReadonlyArray<LanguageLines> => {
  const total = languages.reduce((sum, { lines }) => sum + lines, 0);
  return languages.filter(
    ({ lines }) => lines > 0 && lines / total >= polyglotMinShare,
  );
};

const netLinesByLanguage = (
  { changes }: ClassifiedCommit,
  isCodePath: (path: string) => boolean,
): ReadonlyMap<string, number> => {
  const net = new Map<string, number>();
  for (const { path, added, deleted } of changes) {
    if (isCodePath(path)) {
      const name = languageNameOf(path);
      net.set(name, (net.get(name) ?? 0) + added - deleted);
    }
  }
  return net;
};

/**
 * The time, in seconds since the epoch, of the first commit after which
 * `polyglotLanguages` languages each held `polyglotMinShare` of the estimated
 * code lines; undefined when no commit did. `commits` are newest first.
 */
export const firstPolyglotTime = (
  commits: ReadonlyArray<ClassifiedCommit>,
  isCodePath: (path: string) => boolean,
): number | undefined => {
  const lines = new Map<string, number>();
  for (const commit of commits.toReversed()) {
    const net = netLinesByLanguage(commit, isCodePath);
    if (net.size > 0) {
      for (const [name, change] of net) {
        lines.set(name, Math.max(0, (lines.get(name) ?? 0) + change));
      }
      const languages = [...lines].map(([name, count]) => ({
        name,
        lines: count,
      }));
      if (significantLanguages(languages).length >= polyglotLanguages) {
        return commit.time;
      }
    }
  }
  return undefined;
};
