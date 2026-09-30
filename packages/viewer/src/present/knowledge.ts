import type { Report } from "@codesaga/engine";

import { formatCount, formatDate, formatPercent } from "./format.js";

type Knowledge = Report["knowledge"];
type Directory = Knowledge["directories"][number];
type Expert = Directory["experts"][number];

/** A flag on a directory; `symbol` keeps the meaning readable without color. */
export type Badge = {
  readonly kind: "orphaned" | "island";
  readonly label: string;
  readonly symbol: string;
};

/** The flags of a directory, the graver (orphaned) first; none for a healthy directory. */
export const directoryBadges = ({ orphaned, island }: Directory): Badge[] => [
  ...(orphaned
    ? [{ kind: "orphaned", label: "Orphaned", symbol: "▲" } satisfies Badge]
    : []),
  ...(island
    ? [{ kind: "island", label: "Island", symbol: "■" } satisfies Badge]
    : []),
];

/** A person of the knowledge model, split into the parts the page styles differently. */
export type PersonLine = {
  readonly name: string;
  readonly active: boolean;
  /** `active`, or `inactive since 2025-11-14`: the date of their last commit. */
  readonly status: string;
};

const personLine = ({
  name,
  active,
  lastCommitAt,
}: Pick<Expert, "name" | "active" | "lastCommitAt">): PersonLine => ({
  name,
  active,
  status: active ? "active" : `inactive since ${formatDate(lastCommitAt)}`,
});

/** An expert with their reach: `detail` reads `13 files (93%)`. */
export type ExpertLine = PersonLine & { readonly detail: string };

/** How a directory's expert is listed; an inactive expert says since when. */
export const expertLine = (expert: Expert): ExpertLine => ({
  ...personLine(expert),
  detail: `${formatCount(expert.files)} ${expert.files === 1 ? "file" : "files"} (${formatPercent(expert.share)})`,
});

/** The people whose departure the truck factor counts, in removal order. */
export const truckFactorPeople = ({ truckFactor }: Knowledge): PersonLine[] =>
  truckFactor.people.map((person) => personLine(person));

/** One sentence on what the truck factor means for this repository. */
export const truckFactorSentence = ({
  truckFactor,
  files,
}: Knowledge): string => {
  if (truckFactor.value === 0) {
    return "More than half of the files already have no expert.";
  }
  const departure =
    truckFactor.value === 1
      ? "this person leaves"
      : `these ${formatCount(truckFactor.value)} people leave`;
  return `If ${departure}, more than half of the ${formatCount(files)} files have no expert.`;
};

/** How many files lack an expert, and an active one. */
export const coverageSentence = ({
  files,
  withoutExpert,
  withoutActiveExpert,
}: Knowledge): string =>
  files === 0
    ? "No code files."
    : `${formatCount(withoutExpert)} of ${formatCount(files)} files have no expert; ${formatCount(withoutActiveExpert)} have no active expert.`;

/**
 * The one sentence that replaces a table of identical rows: set when every
 * listed directory has the same single expert, `null` otherwise. The table
 * then leaves out the per-row reasons, which would only repeat it.
 */
export const soleExpertSummary = ({
  directories,
}: Knowledge): string | null => {
  const [first] = directories;
  const sole = first?.experts[0];
  if (
    sole === undefined ||
    !directories.every(
      ({ experts }) => experts.length === 1 && experts[0]?.email === sole.email,
    )
  ) {
    return null;
  }
  const { name, active, status } = personLine(sole);
  const who = active ? name : `${name} (${status})`;
  const where =
    directories.length === 1
      ? "this directory"
      : `all ${formatCount(directories.length)} directories`;
  return `${who} is the only expert in ${where}.`;
};
