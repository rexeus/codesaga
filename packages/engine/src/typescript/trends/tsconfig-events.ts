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

/** The flags of one config, with the path it has in the tree and the line of history that holds it. */
type ConfigFlags = {
  readonly line: number;
  readonly path: string;
  readonly flags: Flags;
};

/** The configs of each line of history; an `extends` is followed within one line. */
type Lines = Map<number, Map<string, RawTsconfig>>;

/** The commits of the first-parent chain and of the histories it absorbed, oldest first, and the text of every config version they change by blob id. */
type ConfigHistory = {
  readonly commits: ReadonlyArray<
    Pick<FirstParentCommit, "time" | "changes" | "line" | "absorbs">
  >;
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

/** The flags of every config of every line, by line and path: two lines may hold a config at the same path. */
const allFlags = (lines: Lines): ReadonlyMap<string, ConfigFlags> =>
  new Map(
    [...lines].flatMap(([line, configs]) =>
      [...configs.keys()].flatMap((path) => {
        const flags = flagsOf(configs, path);
        return flags === undefined
          ? []
          : [[`${line}:${path}`, { line, path, flags }] as const];
      }),
    ),
  );

const dayOf = (seconds: number): string =>
  new Date(seconds * 1000).toISOString().slice(0, 10);

/**
 * What a merge's changes are judged against: the configs before it, with those
 * of the histories it absorbs now held by its own line (what the merge's own
 * changes then say is what the tree holds). A config the line already holds at
 * the same path stays as it was.
 */
const handedOver = (
  known: ReadonlyMap<string, ConfigFlags>,
  absorbs: ReadonlyArray<number>,
  line: number,
): ReadonlyMap<string, ConfigFlags> => {
  const handed = new Map(known);
  for (const config of known.values()) {
    const key = `${line}:${config.path}`;
    if (absorbs.includes(config.line) && !handed.has(key)) {
      handed.set(key, { ...config, line });
    }
  }
  return handed;
};

/**
 * The flips between `before` and `after`: a definite value that changed in a
 * config that existed, and a flag first switched on, by a new config, where
 * no config of its line of history had it on before. Only a value written down in the config or in
 * one it extends counts: `true` that becomes unset (a key removed, a root that
 * turned into a solution-style config of references) or unresolvable is not
 * "turned off", since the default is no claim, and a flag that becomes
 * explicit after being unset is not a flip either, as nothing was known
 * before.
 */
const flipsOf = (
  before: ReadonlyMap<string, ConfigFlags>,
  after: ReadonlyMap<string, ConfigFlags>,
  date: string,
): ReadonlyArray<FlagEvent> =>
  [...after]
    .toSorted(([, left], [, right]) => left.path.localeCompare(right.path))
    .flatMap(([key, { line, path, flags }]) =>
      FLAGS.flatMap((flag): Array<FlagEvent> => {
        const to = flags[flag];
        const from = before.get(key)?.flags[flag];
        if (typeof to !== "boolean" || from === "unknown" || from === to) {
          return [];
        }
        const firstOn =
          from === undefined &&
          to &&
          ![...before.values()].some(
            (other) => other.line === line && other.flags[flag] === true,
          );
        return from !== undefined || firstOn
          ? [{ date, path, flag, from: from ?? null, to }]
          : [];
      }),
    );

const withText = (
  lines: Lines,
  version: {
    readonly line: number;
    readonly path: string;
    readonly oid?: string;
  },
  texts: ReadonlyMap<string, string>,
): void => {
  const { line, path, oid } = version;
  const text = oid === undefined ? undefined : texts.get(oid);
  const raw = text === undefined ? undefined : parseTsconfig(text);
  const configs = lines.get(line) ?? new Map<string, RawTsconfig>();
  lines.set(line, configs);
  if (raw === undefined) {
    configs.delete(path);
  } else {
    configs.set(path, raw);
  }
};

/**
 * Every change of `strict` and `noUncheckedIndexedAccess` in the project's
 * configs, oldest first, found by replaying the first-parent chain and the
 * chains of the histories it absorbed, each with its own configs until the
 * merge that took it in replaces them with its own changes. Each
 * commit that changes a config is judged on every config as the commit's own
 * files have it, so a base config's flip shows on the configs that extend it
 * and an `extends` in an old version resolves against the paths of its time,
 * a renamed base included.
 */
export const flagEventsOf = (
  history: ConfigHistory,
): ReadonlyArray<FlagEvent> => {
  const lines: Lines = new Map();
  let known = allFlags(lines);
  const events: Array<FlagEvent> = [];
  for (const { time, changes, line = 0, absorbs = [] } of history.commits) {
    const own = changes.filter(({ path }) => isProjectTsconfigPath(path));
    const before = handedOver(known, absorbs, line);
    for (const absorbed of absorbs) {
      lines.delete(absorbed);
    }
    for (const { path, oid } of own) {
      withText(
        lines,
        { line, path, ...(oid === undefined ? {} : { oid }) },
        history.texts,
      );
    }
    if (own.length > 0 || absorbs.length > 0) {
      const next = allFlags(lines);
      events.push(...flipsOf(before, next, dayOf(time)));
      known = next;
    }
  }
  return events;
};
