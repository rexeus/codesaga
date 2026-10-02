// Owns the "Deep dive: TypeScript" block of the `analyze` view: coverage, type safety, strictness, complexity, modules, ecosystem, imports and tests in at most eight lines.
// Counts only, except the parser's own words and the names of tools, which pass terminal-safe escaping.
import type { Report } from "@codesaga/engine";

import { escapeForTerminal } from "../escape.js";
import { count, plural, share } from "./format.js";
import { section } from "./layout.js";
import type { Style } from "./style.js";

type TypeScript = NonNullable<NonNullable<Report["deepDives"]>["typescript"]>;

const SEPARATOR = " · ";
const TOP_TOOLS = 4;
/** The tools worth naming beside the code: what the code is built with, not how it is checked or built. */
const STACK = new Set(["framework", "server", "data", "library", "validation"]);

/** One decimal at most: `4`, `4.1`. */
const figure = (value: number): string => count(Math.round(value * 10) / 10);

const coverageLine = ({ coverage }: TypeScript): string => {
  if (coverage.unavailable !== undefined) {
    return `parser unavailable: ${escapeForTerminal(coverage.unavailable)}`;
  }
  const skipped = Object.values(coverage.skipped).reduce(
    (total, value) => total + value,
    0,
  );
  return [
    `${plural(coverage.parsed, "file")} parsed`,
    ...(coverage.declarationFiles === 0
      ? []
      : [plural(coverage.declarationFiles, "declaration file")]),
    ...(skipped === 0 ? [] : [`${count(skipped)} skipped`]),
  ].join(SEPARATOR);
};

const typeSafetyLine = ({
  production,
}: NonNullable<TypeScript["typeSafety"]>): string =>
  [
    `${figure(production.escapesPer1000)} escape hatches per 1,000 lines`,
    `${count(production.counts.any)} any`,
    `${count(production.counts.tsIgnore + production.counts.tsNocheck)} @ts-ignore or @ts-nocheck`,
  ].join(SEPARATOR);

const strictnessLine = ({
  configs,
  totalConfigs,
  typescript,
}: NonNullable<TypeScript["strictness"]>): string => {
  if (totalConfigs === 0) {
    return "no tsconfig";
  }
  const strict = configs.filter((config) => config.strict === true).length;
  const indexed = configs.filter(
    (config) => config.noUncheckedIndexedAccess === true,
  ).length;
  return [
    `strict in ${strict} of ${plural(totalConfigs, "tsconfig")}`,
    `noUncheckedIndexedAccess in ${indexed}`,
    ...(typescript.declared === null
      ? []
      : [`TypeScript ${escapeForTerminal(typescript.declared)}`]),
  ].join(SEPARATOR);
};

const complexityLine = ({
  production,
}: NonNullable<TypeScript["functions"]>): string =>
  production.functions === 0
    ? "no functions"
    : [
        plural(production.functions, "function"),
        `hardest ${count(production.complexity.max)}`,
        `${count(production.over15.functions)} at 15 or more hold ${share(production.over15.lines, production.codeLines)} of the code`,
      ].join(SEPARATOR);

const modulesLine = ({
  esmFiles,
  commonjsFiles,
}: NonNullable<TypeScript["modules"]>): string =>
  [plural(esmFiles, "ES module file"), `${count(commonjsFiles)} CommonJS`].join(
    SEPARATOR,
  );

const ecosystemLine = ({
  tools,
}: NonNullable<TypeScript["ecosystem"]>): string => {
  const names = tools
    .filter(({ category, files }) => STACK.has(category) && files > 0)
    .slice(0, TOP_TOOLS)
    .map(({ name }) => escapeForTerminal(name));
  return names.length === 0 ? "no framework detected" : names.join(SEPARATOR);
};

const importsLine = ({
  files,
  territories,
}: NonNullable<TypeScript["imports"]>): string =>
  [
    `${plural(files.cycles.count, "import cycle")}${files.cycles.count === 0 ? "" : ` (largest ${count(files.cycles.largest)} files)`}`,
    ...(territories.totalMutualImports === 0
      ? []
      : [
          `${plural(territories.totalMutualImports, "group")} of territories import each other`,
        ]),
  ].join(SEPARATOR);

const testsLine = ({
  files,
  cases,
  focused,
  frameworks,
}: NonNullable<TypeScript["tests"]>): string =>
  [
    `${plural(cases, "test case")} in ${plural(files, "file")}`,
    ...(frameworks.length === 0
      ? []
      : [frameworks.map((name) => escapeForTerminal(name)).join(", ")]),
    ...(focused === 0 ? [] : [`${count(focused)} focused`]),
  ].join(SEPARATOR);

/** The lines of the blocks that exist, in the order of the plan. */
const linesOf = (typescript: TypeScript): ReadonlyArray<string> => {
  const {
    typeSafety,
    strictness,
    functions,
    modules,
    ecosystem,
    imports,
    tests,
  } = typescript;
  return [
    coverageLine(typescript),
    ...(typeSafety === undefined ? [] : [typeSafetyLine(typeSafety)]),
    ...(strictness === undefined ? [] : [strictnessLine(strictness)]),
    ...(functions === undefined ? [] : [complexityLine(functions)]),
    ...(modules === undefined ? [] : [modulesLine(modules)]),
    ...(ecosystem === undefined ? [] : [ecosystemLine(ecosystem)]),
    ...(imports === undefined ? [] : [importsLine(imports)]),
    ...(tests === undefined ? [] : [testsLine(tests)]),
  ];
};

/** The TypeScript deep dive as a labelled block of at most eight lines; no lines at all without it. */
export const typescriptLines = (
  { deepDives }: Report,
  style: Style,
): ReadonlyArray<string> =>
  deepDives?.typescript === undefined
    ? []
    : section("Deep dive: TypeScript", linesOf(deepDives.typescript), style);
