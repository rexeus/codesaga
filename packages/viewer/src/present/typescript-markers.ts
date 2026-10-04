import { formatShareExact } from "./code-stats.js";
import { formatCount, formatNoun, formatPerThousand } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Markers = NonNullable<TypeScriptDeepDive["markers"]>;

/** A debt marker with its count and its rate per 1,000 lines. */
type MarkerRow = {
  readonly label: string;
  readonly count: string;
  readonly rate: string;
};

/** The debt markers and how much of the exports is documented. */
export type MarkersView = {
  readonly rows: readonly MarkerRow[];
  /** `62% of 1,204 exported declarations have a JSDoc block`. */
  readonly documented: string;
  readonly documentedShare: number;
};

/** The marker counts and the documented exports; tells nothing of age and gives no verdict. */
export const markersView = ({
  lines,
  todo,
  fixme,
  hack,
  xxx,
  deprecated,
  exportedDeclarations,
  documentedExports,
  documentedShare,
}: Markers): MarkersView => {
  const counts: readonly (readonly [string, number])[] = [
    ["TODO", todo],
    ["FIXME", fixme],
    ["HACK", hack],
    ["XXX", xxx],
    ["@deprecated", deprecated],
  ];
  const rate = (count: number): string =>
    formatPerThousand(lines === 0 ? 0 : (count * 1000) / lines);
  return {
    rows: counts.map(([label, count]) => ({
      label,
      count: formatCount(count),
      rate: rate(count),
    })),
    documented:
      exportedDeclarations === 0
        ? "No exported declaration."
        : `${formatShareExact(documentedExports, exportedDeclarations)} of ${formatNoun(exportedDeclarations, "exported declaration")} have a JSDoc block`,
    documentedShare,
  };
};

/** The folded card's line: the markers that exist and the documented share. */
export const markersTeaser = ({
  todo,
  fixme,
  hack,
  xxx,
  exportedDeclarations,
  documentedExports,
}: Markers): string => {
  const debt = todo + fixme + hack + xxx;
  const documented =
    exportedDeclarations === 0
      ? []
      : [
          `${formatShareExact(documentedExports, exportedDeclarations)} of exports documented`,
        ];
  return [formatNoun(debt, "debt marker"), ...documented].join(" · ");
};
