// Owns when a `tsconfig` started or stopped setting `strict` and `noUncheckedIndexedAccess`, from the versions of the configs over the history.
// Effective values are the config's own over the configs it extends, resolved against the files the commit had; an `extends` that names a package cannot be followed and leaves the value unknown. A flag nothing sets is unknown too, never off: only changes between two written values are events.
import type { FirstParentCommit } from "../../history/first-parent.js";
import type { Trends } from "../../report/typescript-trends.js";
import { isProjectTsconfigPath } from "../../universe/project-files.js";
import { parseTsconfig } from "../tsconfig/config-file.js";
import type { LoadedTsconfig, RawTsconfig } from "../tsconfig/config-file.js";
import { explicitFlagOf } from "../tsconfig/effective-options.js";
import { directoryOf, joinPosix } from "../tsconfig/posix-path.js";

type FlagEvent = Trends["events"][number];

/** The flags the events follow. */
const FLAGS = ["strict", "noUncheckedIndexedAccess"] as const;

/** A longer `extends` chain is cut, as the reader of the current configs does. */
const MAX_EXTENDS_DEPTH = 10;

type Configs = ReadonlyMap<string, RawTsconfig>;
type Flags = Readonly<Record<(typeof FLAGS)[number], boolean | "unknown">>;

/** The commits of the first-parent chain, oldest first, and the text of every config version they change by blob id. */
type ConfigHistory = {
  readonly commits: ReadonlyArray<{
    readonly time: number;
    readonly changes: ReadonlyArray<FirstParentCommit["changes"][number]>;
  }>;
  readonly texts: ReadonlyMap<string, string>;
};

/** The file a relative `extends` names among `configs`, as TypeScript tries it: as written, then with `.json`. */
const resolveExtends = (
  configs: Configs,
  directory: string,
  specifier: string,
): string | undefined => {
  if (!specifier.startsWith(".")) {
    return undefined;
  }
  const target = joinPosix(directory, specifier);
  return [target, `${target}.json`].find((path) => configs.has(path));
};

const load = (
  configs: Configs,
  path: string,
  trail: ReadonlyArray<string> = [],
): LoadedTsconfig | undefined => {
  const raw = configs.get(path);
  if (
    raw === undefined ||
    trail.includes(path) ||
    trail.length >= MAX_EXTENDS_DEPTH
  ) {
    return undefined;
  }
  const directory = directoryOf(path);
  return {
    ...raw,
    path,
    directory,
    extends: raw.extends.map((specifier) => {
      const target = resolveExtends(configs, directory, specifier);
      return {
        specifier,
        config:
          target === undefined
            ? undefined
            : load(configs, target, [...trail, path]),
      };
    }),
  };
};

const flagsOf = (configs: Configs, path: string): Flags | undefined => {
  const config = load(configs, path);
  if (config === undefined) {
    return undefined;
  }
  return {
    strict: explicitFlagOf(config, "strict"),
    noUncheckedIndexedAccess: explicitFlagOf(
      config,
      "noUncheckedIndexedAccess",
    ),
  };
};

const allFlags = (configs: Configs): ReadonlyMap<string, Flags> =>
  new Map(
    [...configs.keys()].flatMap((path) => {
      const flags = flagsOf(configs, path);
      return flags === undefined ? [] : [[path, flags] as const];
    }),
  );

const dayOf = (seconds: number): string =>
  new Date(seconds * 1000).toISOString().slice(0, 10);

/**
 * The flips between `before` and `after`: a definite value that changed in a
 * config that existed, and a flag first switched on, by a new config, where
 * no config had it on before. Only a value written down in the config or in
 * one it extends counts: `true` that becomes unset (a key removed, a root that
 * turned into a solution-style config of references) or unresolvable is not
 * "turned off", since the default is no claim, and a flag that becomes
 * explicit after being unset is not a flip either, as nothing was known
 * before.
 */
const flipsOf = (
  before: ReadonlyMap<string, Flags>,
  after: ReadonlyMap<string, Flags>,
  date: string,
): ReadonlyArray<FlagEvent> =>
  [...after]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .flatMap(([path, flags]) =>
      FLAGS.flatMap((flag): Array<FlagEvent> => {
        const to = flags[flag];
        const from = before.get(path)?.[flag];
        if (typeof to !== "boolean" || from === "unknown" || from === to) {
          return [];
        }
        const firstOn =
          from === undefined &&
          to &&
          ![...before.values()].some((other) => other[flag] === true);
        return from !== undefined || firstOn
          ? [{ date, path, flag, from: from ?? null, to }]
          : [];
      }),
    );

const withText = (
  configs: Map<string, RawTsconfig>,
  path: string,
  oid: string | undefined,
  texts: ReadonlyMap<string, string>,
): void => {
  const text = oid === undefined ? undefined : texts.get(oid);
  const raw = text === undefined ? undefined : parseTsconfig(text);
  if (raw === undefined) {
    configs.delete(path);
  } else {
    configs.set(path, raw);
  }
};

/**
 * Every change of `strict` and `noUncheckedIndexedAccess` in the project's
 * configs, oldest first, found by replaying the first-parent chain. Each
 * commit that changes a config is judged on every config as the commit's own
 * files have it, so a base config's flip shows on the configs that extend it
 * and an `extends` in an old version resolves against the paths of its time,
 * a renamed base included.
 */
export const flagEventsOf = (
  history: ConfigHistory,
): ReadonlyArray<FlagEvent> => {
  const configs = new Map<string, RawTsconfig>();
  let known = allFlags(configs);
  const events: Array<FlagEvent> = [];
  for (const { time, changes } of history.commits) {
    const own = changes.filter(({ path }) => isProjectTsconfigPath(path));
    for (const { path, oid } of own) {
      withText(configs, path, oid, history.texts);
    }
    if (own.length > 0) {
      const next = allFlags(configs);
      events.push(...flipsOf(known, next, dayOf(time)));
      known = next;
    }
  }
  return events;
};
