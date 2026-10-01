// Owns counting the distinct people behind a set of commits, shared by the sections that report it.

import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";

/** Distinct identities with a human or agent-assisted commit; bots and agents are not contributors. */
export const countContributors = (
  commits: ReadonlyArray<ClassifiedCommit>,
): number =>
  new Set(
    commits
      .filter((commit) => isContributorCommit(commit))
      .map((commit) => commit.author.email),
  ).size;
