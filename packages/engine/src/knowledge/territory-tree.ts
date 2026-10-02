// Owns when and how a territory splits into its child folders: the size rule, the expertise rule and the reason.
// Pure over paths and who is expert on them, so the policy is testable beside `territory-partition.ts`, which orders the splits.
// Cost: one pass over the territory's files per candidate split.

import { groupBy } from "../collections/group-by.js";

/** A territory with fewer universe files is not a unit of its own; it joins the other files. */
export const TERRITORY_MIN_FILES = 3;

/** A territory with more than this share of all universe files is big. */
export const BIG_SHARE = 0.4;

/** A territory is big above this many files, however small the repository ... */
export const BIG_MIN_FILES = 30;

/** ... or large the repository ... */
export const BIG_MAX_FILES = 150;

/** ... and in between above this share of all files. */
export const BIG_FILES_SHARE = 0.25;

/** A child's main expert must be an expert on at least this share of the child's files that have one. */
export const MAIN_EXPERT_SHARE = 0.5;

/** A territory that is split, or that one split yields; `paths` are universe files. */
export type TreeTerritory = {
  readonly path: string;
  readonly kind: "package" | "folder" | "other";
  readonly paths: ReadonlyArray<string>;
};

/** What splitting a territory yields. */
export type SplitPlan = {
  /** Folders with at least `TERRITORY_MIN_FILES` files, at least two, largest first. */
  readonly folders: ReadonlyArray<{
    readonly path: string;
    readonly paths: ReadonlyArray<string>;
  }>;
  /** The files that no folder claims: direct files and small folders. Empty when there are none. */
  readonly other: ReadonlyArray<string>;
  /** "big: 52 files" or "src/api and src/ui have different experts". */
  readonly reason: string;
  /** Folders with different main experts, less one; 0 for a split by size alone. */
  readonly expertiseGain: number;
  /** The territory holds more than `BIG_SHARE` of all files: it never stands as one card, so the split is not left for a finer detail. */
  readonly dominant: boolean;
};

export type SplitContext = {
  /** The universe files of the analysis. */
  readonly totalFiles: number;
  /** The emails of the experts of a file; empty for none. */
  readonly expertsOf: (path: string) => ReadonlyArray<string>;
};

type Cut = {
  readonly folders: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly stray: ReadonlyArray<string>;
};

/**
 * The folders directly below `prefix` that hold enough files, and the files
 * outside them. Where exactly one folder holds enough files, the cut goes
 * on inside it, so `packages/db` with only `src` and a few files beside it
 * splits `src`'s folders and leaves the few files as other files.
 */
const cutBelow = (
  prefix: string,
  paths: ReadonlyArray<string>,
  stray: ReadonlyArray<string>,
): Cut => {
  const below = (path: string): string => path.slice(prefix.length);
  const inFolders = paths.filter((path) => below(path).includes("/"));
  const folders = groupBy(
    inFolders,
    (path) => `${prefix}${below(path).split("/")[0]}`,
  );
  const enough = [...folders].filter(
    ([, files]) => files.length >= TERRITORY_MIN_FILES,
  );
  const leftovers = [
    ...stray,
    ...paths.filter((path) => !below(path).includes("/")),
    ...[...folders]
      .filter(([, files]) => files.length < TERRITORY_MIN_FILES)
      .flatMap(([, files]) => files),
  ];
  const [only] = enough;
  return enough.length === 1 && only !== undefined
    ? cutBelow(`${only[0]}/`, only[1], leftovers)
    : { folders: new Map(enough), stray: leftovers };
};

/** How many of a folder's files each person is an expert on, and how many of its files have an expert. */
type Expertise = {
  readonly counts: ReadonlyMap<string, number>;
  readonly withExpert: number;
};

const expertiseOf = (
  paths: ReadonlyArray<string>,
  expertsOf: SplitContext["expertsOf"],
): Expertise => {
  const counts = new Map<string, number>();
  let withExpert = 0;
  for (const path of paths) {
    const experts = expertsOf(path);
    withExpert += experts.length > 0 ? 1 : 0;
    for (const email of experts) {
      counts.set(email, (counts.get(email) ?? 0) + 1);
    }
  }
  return { counts, withExpert };
};

/** The share of the folder's files with an expert that `email` is an expert on. */
const shareOf = ({ counts, withExpert }: Expertise, email: string): number =>
  (counts.get(email) ?? 0) / withExpert;

/** The one person who is an expert on the most files, when no one else is on as many and they are on at least `MAIN_EXPERT_SHARE` of the files that have an expert. */
const mainExpertOf = (expertise: Expertise): string | undefined => {
  const [first, second] = [...expertise.counts].toSorted(
    ([, a], [, b]) => b - a,
  );
  return first !== undefined &&
    first[1] !== second?.[1] &&
    shareOf(expertise, first[0]) >= MAIN_EXPERT_SHARE
    ? first[0]
    : undefined;
};

const isBig = (files: number, totalFiles: number): boolean =>
  files >
    Math.min(
      BIG_MAX_FILES,
      Math.max(BIG_MIN_FILES, BIG_FILES_SHARE * totalFiles),
    ) || files > BIG_SHARE * totalFiles;

type Folder = {
  readonly path: string;
  readonly expertise: Expertise;
  readonly expert: string | undefined;
};

/** Folders have different experts when each one's main expert is not an expert on at least `MAIN_EXPERT_SHARE` of the other's files, which would make them the same circle of people. */
const differ = (a: Folder, b: Folder): boolean =>
  a.expert !== undefined &&
  b.expert !== undefined &&
  a.expert !== b.expert &&
  shareOf(a.expertise, b.expert) < MAIN_EXPERT_SHARE &&
  shareOf(b.expertise, a.expert) < MAIN_EXPERT_SHARE;

/** The folders with a main expert, largest first, that differ from every one chosen before them. */
const distinctLeaders = (
  folders: ReadonlyArray<Folder>,
): ReadonlyArray<Folder> => {
  const chosen: Array<Folder> = [];
  for (const folder of folders) {
    if (
      folder.expert !== undefined &&
      chosen.every((one) => differ(one, folder))
    ) {
      chosen.push(folder);
    }
  }
  return chosen;
};

/** Why the folders are worth a split: the two largest that have different main experts, else the territory's size; undefined for neither. */
const reasonOf = (
  leaders: ReadonlyArray<Folder>,
  files: number,
  totalFiles: number,
): string | undefined => {
  const [first, second] = leaders;
  if (first !== undefined && second !== undefined) {
    return `${first.path} and ${second.path} have different experts`;
  }
  return isBig(files, totalFiles) ? `big: ${files} files` : undefined;
};

/**
 * How `territory` would split into its child folders, or undefined when it should
 * not. It splits when it is big (more than `min(BIG_MAX_FILES, max(BIG_MIN_FILES,
 * files / 4))` of the analysis's files, or more than `BIG_SHARE` of them) or when
 * its folders have different main experts (see `differ`), and only when at least
 * two folders hold `TERRITORY_MIN_FILES` files. The reason names the folders when
 * their experts differ, else the size. Other files never split.
 */
export const planSplit = (
  { path, kind, paths }: TreeTerritory,
  { totalFiles, expertsOf }: SplitContext,
): SplitPlan | undefined => {
  if (kind === "other") {
    return undefined;
  }
  const { folders, stray } = cutBelow(
    path === "." ? "" : `${path}/`,
    paths,
    [],
  );
  if (folders.size < 2) {
    return undefined;
  }
  const sized = [...folders]
    .map(([folder, files]) => {
      const expertise = expertiseOf(files, expertsOf);
      return {
        path: folder,
        paths: files,
        expertise,
        expert: mainExpertOf(expertise),
      };
    })
    .toSorted(
      (a, b) => b.paths.length - a.paths.length || (a.path < b.path ? -1 : 1),
    );
  const leaders = distinctLeaders(sized);
  const reason = reasonOf(leaders, paths.length, totalFiles);
  return reason === undefined
    ? undefined
    : {
        folders: sized.map(({ path: folder, paths: files }) => ({
          path: folder,
          paths: files,
        })),
        other: stray,
        reason,
        dominant: paths.length > BIG_SHARE * totalFiles,
        expertiseGain: Math.max(0, leaders.length - 1),
      };
};
