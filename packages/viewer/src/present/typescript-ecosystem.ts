import { formatCount, formatNoun } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Ecosystem = NonNullable<TypeScriptDeepDive["ecosystem"]>;
type Tool = Ecosystem["tools"][number];

const CATEGORIES: readonly {
  readonly key: Tool["category"];
  readonly label: string;
}[] = [
  { key: "framework", label: "Frameworks" },
  { key: "server", label: "Servers" },
  { key: "data", label: "Data" },
  { key: "library", label: "Libraries" },
  { key: "validation", label: "Validation" },
  { key: "test", label: "Testing" },
  { key: "build", label: "Build" },
  { key: "lint", label: "Lint" },
  { key: "format", label: "Format" },
  { key: "monorepo", label: "Monorepo" },
];

/** A tool the code imports or a manifest declares. */
type ToolChip = {
  readonly name: string;
  /** `1,083 files`, or `declared only` when no file imports it. */
  readonly detail: string;
};

/** The detected tools of one category. */
export type ToolGroup = {
  readonly label: string;
  readonly tools: readonly ToolChip[];
};

/** The tools by category, in a fixed order; a category without a tool is left out. */
export const toolGroups = ({ tools }: Ecosystem): ToolGroup[] =>
  CATEGORIES.flatMap(({ key, label }) => {
    const inCategory = tools.filter(({ category }) => category === key);
    return inCategory.length === 0
      ? []
      : [
          {
            label,
            tools: inCategory.map(({ name, files }) => ({
              name,
              detail: files === 0 ? "declared only" : formatNoun(files, "file"),
            })),
          },
        ];
  });

/** A package or built-in with the files that import it. */
export type ImportedRow = {
  readonly name: string;
  readonly files: string;
  /** The files over the most imported one's, 0 to 1. */
  readonly fraction: number;
};

/** The most imported names, each sized against the first. */
export const importedRows = (list: Ecosystem["packages"]): ImportedRow[] => {
  const most = Math.max(1, ...list.map(({ files }) => files));
  return list.map(({ name, files }) => ({
    name,
    files: formatCount(files),
    fraction: files / most,
  }));
};

/** The counts around the lists. */
export const ecosystemFacts = ({
  dependencies,
  hooks,
  undeclared,
}: Ecosystem): string[] => [
  dependencies.manifests === 0
    ? "No package.json was read."
    : `${formatNoun(dependencies.manifests, "package.json file")} declare ${formatCount(dependencies.runtime)} runtime and ${formatCount(dependencies.dev)} development dependencies.`,
  ...(hooks.calls === 0
    ? []
    : [
        `${formatNoun(hooks.calls, "hook call")} (functions named use…) in ${formatNoun(hooks.files, "file")}.`,
      ]),
  ...(undeclared === 0
    ? []
    : [
        `${formatNoun(undeclared, "bare specifier")} no manifest declares: path aliases, or dependencies declared outside the analyzed files.`,
      ]),
];

/** The names of the first three tools and how many more there are, for the folded card. */
export const ecosystemTeaser = ({ tools }: Ecosystem): string => {
  if (tools.length === 0) {
    return "No known tool detected";
  }
  const names = tools.slice(0, 3).map(({ name }) => name);
  const more = tools.length - names.length;
  return `${names.join(", ")}${more > 0 ? ` and ${formatCount(more)} more` : ""}`;
};
