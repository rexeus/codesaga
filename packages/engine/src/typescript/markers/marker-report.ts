// Owns turning the marker facts of the production files into the report's `markers` block.

import type { Markers } from "../../report/typescript-markers.js";
import { ratioOf, sum } from "../../stats/measures.js";
import { isTestPath } from "../../universe/path-kinds.js";
import type { ParsedFile } from "../parsed-file.js";
import type { MarkerFacts } from "./marker-facts.js";

/** The debt markers of the files that are not tests. */
export const markersReportOf = (files: ReadonlyArray<ParsedFile>): Markers => {
  const production = files.filter(({ path }) => !isTestPath(path));
  const total = (count: (facts: MarkerFacts) => number): number =>
    sum(production.map(({ facts }) => count(facts.markers)));
  const exported = total((markers) => markers.exportedDeclarations);
  const documented = total((markers) => markers.documentedExports);
  return {
    files: production.length,
    lines: sum(production.map((file) => file.lines)),
    todo: total((markers) => markers.todo),
    fixme: total((markers) => markers.fixme),
    hack: total((markers) => markers.hack),
    xxx: total((markers) => markers.xxx),
    deprecated: total((markers) => markers.deprecated),
    exportedDeclarations: exported,
    documentedExports: documented,
    documentedShare: ratioOf(documented, exported),
  };
};
