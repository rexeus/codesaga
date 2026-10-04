// Owns reading what `inspect` needs of the TypeScript code: the matched files parsed, and the import graph over the files that may import them.
// Parsing every file of a large repository for one answer costs seconds, so the other files are only scanned as text and the ones that may import a matched file are parsed.
// Cost: one read of every TypeScript and JavaScript file, a text scan of each, and a parse of the matched files and their candidate importers.

import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import type { InventoryFile } from "../../universe/inventory.js";
import type { ProjectFiles } from "../../universe/project-files.js";
import { readManifests } from "../ecosystem/read-manifests.js";
import { readProject, readSource } from "../gather-typescript.js";
import { aliasesByFile } from "../imports/aliases-by-file.js";
import { importGraphOf } from "../imports/import-graph.js";
import { createResolver } from "../imports/resolve.js";
import type { ResolverInputs } from "../imports/resolve.js";
import type { ParsedFile } from "../parsed-file.js";
import { isDeclarationPath, isScriptPath } from "../source-kinds.js";
import { strictnessOf } from "../tsconfig/strictness.js";
import { TypeScriptParser } from "../typescript-parser.js";
import { candidateImporters } from "./candidate-importers.js";
import type { InspectedTypeScript } from "./inspected-files.js";

/** Files read at once; bounds open file handles. */
const READ_CONCURRENCY = 16;

/** The sources of the targets and of the files that may import them. */
const sourcesToParse = (
  root: string,
  scripts: ReadonlyArray<string>,
  targets: ReadonlySet<string>,
  resolution: ResolverInputs,
) =>
  Effect.gen(function* () {
    const sources = yield* Effect.forEach(
      scripts.filter((path) => !isDeclarationPath(path)),
      (path) => readSource(root, path),
      { concurrency: READ_CONCURRENCY },
    );
    const readable = sources.filter((source) => source !== undefined);
    return [
      ...readable.filter(({ path }) => targets.has(path)),
      ...candidateImporters(
        readable.filter(({ path }) => !targets.has(path)),
        targets,
        createResolver(resolution),
      ),
    ];
  });

/**
 * Reads and parses what the TypeScript and JavaScript files among `matched`
 * need, or returns undefined when none is among them or the parser did not
 * load. Never fails: an unreadable file is not a candidate, and the parser's
 * own failures are its verdicts.
 */
export const gatherInspectedTypeScript = (
  root: string,
  universe: ReadonlyArray<InventoryFile>,
  projectFiles: ProjectFiles,
  matched: ReadonlyArray<string>,
): Effect.Effect<
  InspectedTypeScript | undefined,
  never,
  TypeScriptParser | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const scripts = universe
      .map(({ path }) => path)
      .filter((path) => isScriptPath(path));
    const targets = new Set(matched.filter((path) => isScriptPath(path)));
    const parser = yield* TypeScriptParser;
    if (targets.size === 0 || (yield* parser.status).kind !== "ready") {
      return undefined;
    }
    const manifests = yield* readManifests(root, projectFiles.manifests);
    const project = yield* readProject(root, projectFiles, manifests);
    const strictness = strictnessOf(project, scripts);
    const aliasesFor = aliasesByFile(
      project.configs,
      strictness.governingConfigOf,
    );
    const toParse = yield* sourcesToParse(root, scripts, targets, {
      files: new Set(scripts),
      manifests,
      aliasesFor,
    });
    const verdicts = yield* parser.factsOf(toParse);
    const lines = new Map(universe.map(({ path, loc }) => [path, loc]));
    const parsed = toParse.flatMap(({ path }, index) => {
      const verdict = verdicts[index];
      return verdict?.kind === "parsed"
        ? [
            {
              path,
              lines: lines.get(path) ?? 0,
              facts: verdict.facts,
            } satisfies ParsedFile,
          ]
        : [];
    });
    return {
      parsed: new Map(parsed.map((file) => [file.path, file])),
      graph: importGraphOf(scripts, parsed, { manifests, aliasesFor }),
      strictOf: strictness.strictOf,
    };
  });
