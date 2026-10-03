// Owns the four TypeScript achievements that hold today: any-free, strict-throughout, esm-only and no-ts-ignore.
// Each reads the parsed production files, and strictness for the one that needs the configs; none has a day.

import { ACHIEVEMENT_THRESHOLDS } from "../../achievements/thresholds.js";
import { countOf, nounOf } from "../../report/sentences.js";
import type { TypeScriptAchievement } from "../../report/typescript-achievements.js";
import type { Strictness } from "../../report/typescript-strictness.js";
import { sum } from "../../stats/measures.js";
import { isTestPath, isToolingPath } from "../../universe/path-kinds.js";
import type { ParsedFile } from "../parsed-file.js";
import { isTypeScriptPath } from "../source-kinds.js";

const { anyFreeMinFiles, typeScriptMinFiles } = ACHIEVEMENT_THRESHOLDS;

type Progress = TypeScriptAchievement["progress"];

type Judged = Pick<
  TypeScriptAchievement,
  "kind" | "title" | "reached" | "detail"
> & { readonly progress: Progress };

/** A state achievement, whose progress is only kept while it is locked. */
const state = ({ progress, ...judged }: Judged): TypeScriptAchievement => ({
  ...judged,
  reachedAt: null,
  holds: "state",
  progress: judged.reached ? null : progress,
});

/** What a locked achievement still lacks when the repository is too small for it to say anything. */
const tooFew = (files: number, minimum: number, noun: string): Progress => ({
  value: files,
  target: minimum,
  unit: noun,
});

const anyFree = (typescript: ReadonlyArray<ParsedFile>) => {
  const withAny = typescript.filter(({ facts }) => facts.typeSafety.any > 0);
  const files = typescript.length;
  const reached = files >= anyFreeMinFiles && withAny.length === 0;
  const noun = "production TypeScript files";
  let detail = `No explicit any in ${nounOf(files, "production TypeScript file")}.`;
  if (files < anyFreeMinFiles) {
    detail = `${nounOf(files, "production TypeScript file")}; any-free needs at least ${anyFreeMinFiles}.`;
  } else if (!reached) {
    detail = `${countOf(withAny.length)} of ${nounOf(files, "production TypeScript file")} use an explicit any.`;
  }
  return state({
    kind: "any-free",
    title: "Any-free",
    reached,
    detail,
    progress:
      files < anyFreeMinFiles
        ? tooFew(files, anyFreeMinFiles, noun)
        : {
            value: files - withAny.length,
            target: files,
            unit: "production files without any",
          },
  });
};

const strictThroughout = (
  typescript: ReadonlyArray<ParsedFile>,
  { configs, governedFiles, ungovernedFiles }: Strictness,
) => {
  const files = typescript.length;
  const total = governedFiles + ungovernedFiles;
  const strictFiles = sum(
    configs.filter(({ strict }) => strict === true).map(({ files: n }) => n),
  );
  const reached =
    files >= typeScriptMinFiles &&
    governedFiles > 0 &&
    ungovernedFiles === 0 &&
    configs.every(({ files: n, strict }) => n === 0 || strict === true);
  let detail = `Every one of ${nounOf(total, "file")} lies under a strict tsconfig.`;
  if (files < typeScriptMinFiles) {
    detail = `${nounOf(files, "production TypeScript file")}; strict-throughout needs at least ${typeScriptMinFiles}.`;
  } else if (!reached) {
    detail = `${countOf(strictFiles)} of ${nounOf(total, "file")} lie under a strict tsconfig.`;
  }
  return state({
    kind: "strict-throughout",
    title: "Strict throughout",
    reached,
    detail,
    progress:
      files < typeScriptMinFiles
        ? tooFew(files, typeScriptMinFiles, "production TypeScript files")
        : {
            value: strictFiles,
            target: total,
            unit: "files under a strict tsconfig",
          },
  });
};

/** Tool configuration files (`jest.config.js`, `.prettierrc.cjs`) are CommonJS by their tool's convention, so they are no module files here. */
const esmOnly = (production: ReadonlyArray<ParsedFile>) => {
  const modules = production.filter(
    ({ path, facts }) =>
      !isToolingPath(path) && facts.modules.esm + facts.modules.commonjs > 0,
  );
  const commonjs = modules.filter(({ facts }) => facts.modules.commonjs > 0);
  const reached = modules.length >= typeScriptMinFiles && commonjs.length === 0;
  let detail = `No CommonJS in ${nounOf(modules.length, "production module file")}.`;
  if (modules.length < typeScriptMinFiles) {
    detail = `${nounOf(modules.length, "production module file")}; esm-only needs at least ${typeScriptMinFiles}.`;
  } else if (!reached) {
    detail = `${countOf(commonjs.length)} of ${nounOf(modules.length, "production module file")} use CommonJS.`;
  }
  return state({
    kind: "esm-only",
    title: "ESM only",
    reached,
    detail,
    progress:
      modules.length < typeScriptMinFiles
        ? tooFew(modules.length, typeScriptMinFiles, "production module files")
        : {
            value: modules.length - commonjs.length,
            target: modules.length,
            unit: "production module files without CommonJS",
          },
  });
};

const noTsIgnore = (
  production: ReadonlyArray<ParsedFile>,
  typescript: ReadonlyArray<ParsedFile>,
) => {
  const silenced = production.filter(
    ({ facts }) => facts.typeSafety.tsIgnore + facts.typeSafety.tsNocheck > 0,
  );
  const reached =
    typescript.length >= typeScriptMinFiles && silenced.length === 0;
  let detail = `No @ts-ignore or @ts-nocheck in ${nounOf(production.length, "production file")}.`;
  if (typescript.length < typeScriptMinFiles) {
    detail = `${nounOf(typescript.length, "production TypeScript file")}; no-ts-ignore needs at least ${typeScriptMinFiles}.`;
  } else if (!reached) {
    detail = `${countOf(silenced.length)} of ${nounOf(production.length, "production file")} hold a @ts-ignore or @ts-nocheck.`;
  }
  return state({
    kind: "no-ts-ignore",
    title: "No ts-ignore",
    reached,
    detail,
    progress:
      typescript.length < typeScriptMinFiles
        ? tooFew(
            typescript.length,
            typeScriptMinFiles,
            "production TypeScript files",
          )
        : {
            value: production.length - silenced.length,
            target: production.length,
            unit: "production files without @ts-ignore or @ts-nocheck",
          },
  });
};

/**
 * The state achievements of the parsed files: `any-free`, `strict-throughout`,
 * `esm-only` and `no-ts-ignore`, in that order, reached or not. Empty without
 * a production TypeScript file, where none of them has anything to say.
 */
export const stateAchievementsOf = (
  parsed: ReadonlyArray<ParsedFile>,
  strictness: Strictness,
): ReadonlyArray<TypeScriptAchievement> => {
  const production = parsed.filter(({ path }) => !isTestPath(path));
  const typescript = production.filter(({ path }) => isTypeScriptPath(path));
  return typescript.length === 0
    ? []
    : [
        anyFree(typescript),
        strictThroughout(typescript, strictness),
        esmOnly(production),
        noTsIgnore(production, typescript),
      ];
};
