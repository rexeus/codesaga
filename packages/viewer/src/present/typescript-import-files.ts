import { pathTail } from "./code-stats.js";
import { formatCount, formatNoun, formatPercentTenth } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Imports = NonNullable<TypeScriptDeepDive["imports"]>;
type Files = Imports["files"];

/** A file with how many files import it, or how many it imports. */
export type FileCountRow = {
  readonly name: string;
  readonly path: string;
  readonly count: string;
  /** The count over the largest of the list, 0 to 1. */
  readonly fraction: number;
};

const countRows = (
  list: readonly { readonly path: string; readonly count: number }[],
): FileCountRow[] => {
  const largest = Math.max(1, ...list.map(({ count }) => count));
  return list.map(({ path, count }) => ({
    name: pathTail(path),
    path,
    count: formatCount(count),
    fraction: count / largest,
  }));
};

/** A cycle of files that import each other. */
export type CycleRow = {
  /** `4 files in 1 territory`. */
  readonly title: string;
  readonly files: readonly { readonly name: string; readonly path: string }[];
  /** `and 12 more`, or null when the list is whole. */
  readonly more: string | null;
};

/** The shape of the file graph: what imports what at the level of files. */
export type ImportFilesView = {
  readonly facts: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  /** The files imported by the most others. */
  readonly fanIn: readonly FileCountRow[];
  /** The files importing the most others. */
  readonly fanOut: readonly FileCountRow[];
  readonly cycles: readonly CycleRow[];
  /** One sentence on the cycles, which names the type-only ones apart. */
  readonly cycleSummary: string;
  /** The specifiers that point into the repository where no file was found, most named first. */
  readonly unresolved: readonly {
    readonly specifier: string;
    readonly files: string;
  }[];
  /** `12 specifiers point into the repository and found no file: 0.1% of them`. */
  readonly unresolvedSummary: string | null;
};

const cycleSummary = ({ cycles }: Files): string => {
  const { count, largest, withTypes, typeOnly } = cycles;
  const byValue =
    count === 0
      ? "No cycle between production files."
      : `${formatNoun(count, "cycle")} between production files, the largest of ${formatNoun(largest, "file")}.`;
  const types =
    typeOnly === 0
      ? ""
      : ` With type-only imports counted there ${withTypes.count === 1 ? "is" : "are"} ${formatCount(withTypes.count)}, the largest of ${formatNoun(withTypes.largest, "file")}; ${formatCount(typeOnly)} ${typeOnly === 1 ? "exists" : "exist"} only through types, which cost nothing at runtime.`;
  return `${byValue}${types}`;
};

const cycleRows = ({ cycles }: Files): CycleRow[] =>
  cycles.top.map(({ size, files, territories }) => ({
    title: `${formatNoun(size, "file")} in ${formatNoun(territories, "territory", "territories")}`,
    files: files.map((path) => ({ name: pathTail(path), path })),
    more:
      size > files.length
        ? `and ${formatCount(size - files.length)} more`
        : null,
  }));

/** The file graph of the production code: its size, its most imported files, its cycles and the specifiers that found no file. */
export const importFilesView = ({ files }: Imports): ImportFilesView => ({
  facts: [
    {
      value: formatCount(files.files),
      label: "production files in the graph",
    },
    {
      value: formatCount(files.edges.value + files.edges.typeOnly),
      label: `imports between them, ${formatCount(files.edges.typeOnly)} types only`,
    },
    {
      value: formatCount(files.fanIn.median),
      label: "median files importing a file",
    },
    {
      value: formatCount(files.external),
      label: "imports of outside packages and built-ins",
    },
  ],
  fanIn: countRows(files.fanIn.top),
  fanOut: countRows(files.fanOut.top),
  cycles: cycleRows(files),
  cycleSummary: cycleSummary(files),
  unresolved: files.unresolved.top.map(({ specifier, files: named }) => ({
    specifier,
    files: formatNoun(named, "file"),
  })),
  unresolvedSummary:
    files.unresolved.count === 0
      ? null
      : `${formatNoun(files.unresolved.count, "specifier")} into the repository found no file, ${formatPercentTenth(files.unresolved.share)} of those.`,
});
