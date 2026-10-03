// Owns the import structure of the parsed files: the graph, built once, and its figures at the territories a report shows.
// The territories come from the knowledge section, so the figures that name them are drawn up after it.

import type { Imports } from "../../report/typescript-imports.js";
import type { TerritoryTypeScript } from "../../report/typescript-territory.js";
import type { PackageManifest } from "../ecosystem/read-manifests.js";
import type { ParsedFile } from "../parsed-file.js";
import { cyclesOf } from "./file-cycles.js";
import { fileStructureOf } from "./file-structure.js";
import { importGraphOf } from "./import-graph.js";
import { assignmentOf } from "./territory-assignment.js";
import type { VisibleTerritory } from "./territory-assignment.js";
import { territoryMapOf } from "./territory-map.js";
import { territoryImportsOf } from "./territory-neighbours.js";
import type { PathAliases } from "./ts-aliases.js";

/** The import structure at one set of territories. */
export type ImportStructure = {
  readonly section: Imports;
  /**
   * The territory's `typescript` figures with what the imports say of the
   * territory that holds the universe files at `paths`, whatever its detail;
   * unchanged when it holds no file of the graph.
   */
  readonly annotate: (
    typescript: TerritoryTypeScript | undefined,
    paths: ReadonlyArray<string>,
  ) => TerritoryTypeScript | undefined;
};

/** The import graph, ready to be read at territories. */
export type ImportAnalysis = {
  /** The structure at `territories`, the ones shown at `detail`. */
  readonly at: (
    territories: ReadonlyArray<VisibleTerritory>,
    detail: number,
  ) => ImportStructure;
};

/** What the graph is built from. */
export type ImportInputs = {
  /** Every TypeScript and JavaScript file of the universe, parsed or not. */
  readonly paths: ReadonlyArray<string>;
  readonly parsed: ReadonlyArray<ParsedFile>;
  readonly manifests: ReadonlyArray<PackageManifest>;
  /** The `paths` and `baseUrl` of the config that governs a file. */
  readonly aliasesFor: (path: string) => PathAliases | undefined;
};

/** Resolves the module requests of the parsed files into a graph. */
export const importAnalysisOf = ({
  paths,
  parsed,
  manifests,
  aliasesFor,
}: ImportInputs): ImportAnalysis => {
  const graph = importGraphOf(paths, parsed, { manifests, aliasesFor });
  const cycles = cyclesOf(graph);
  return {
    at: (territories, detail) => {
      const assignment = assignmentOf(graph, territories);
      const spanOf = (members: ReadonlyArray<string>): number =>
        new Set(
          members
            .map((path) => assignment.of[graph.indexOf.get(path) ?? -1] ?? -1)
            .filter((index) => index >= 0),
        ).size;
      const importsOf = territoryImportsOf(graph, assignment, cycles);
      return {
        section: {
          files: fileStructureOf(graph, cycles, spanOf),
          territories: territoryMapOf(graph, assignment, detail),
        },
        annotate: (typescript, members) => {
          const imports = importsOf(members);
          return typescript === undefined || imports === undefined
            ? typescript
            : { ...typescript, ...imports };
        },
      };
    },
  };
};
