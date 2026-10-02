// Owns which files the TypeScript analysis reads and how the parser must read each one.
// Pure policy over a path; the parser itself lives behind `TypeScriptParser`.

import { languageOf } from "../universe/languages.js";

/** How to read one file; the values are the parser's own option values. */
export type ParseOptions = {
  readonly lang: "ts" | "tsx" | "jsx";
  readonly sourceType: "module" | "unambiguous" | "commonjs";
};

const DECLARATION_FILE = /\.d\.[cm]?ts$/iu;

/** Whether the path is a TypeScript or JavaScript file by its language. */
export const isScriptPath = (path: string): boolean => {
  const language = languageOf(path);
  return language === "TypeScript" || language === "JavaScript";
};

/** Whether the path is a declaration file: it holds types only, so it is counted and never parsed. */
export const isDeclarationPath = (path: string): boolean =>
  DECLARATION_FILE.test(path);

const LANGUAGE_BY_EXTENSION: ReadonlyMap<string, ParseOptions["lang"]> =
  new Map([
    ["ts", "ts"],
    ["mts", "ts"],
    ["cts", "ts"],
    ["tsx", "tsx"],
  ]);

const SOURCE_TYPE_BY_EXTENSION: ReadonlyMap<
  string,
  ParseOptions["sourceType"]
> = new Map([
  ["cjs", "commonjs"],
  ["cts", "commonjs"],
  ["js", "unambiguous"],
  ["jsx", "unambiguous"],
]);

/**
 * How to parse the file at `path`, from its extension. JavaScript is read as
 * JSX, a superset that costs nothing and accepts React code in `.js`. A `.cjs`
 * or `.cts` file is CommonJS, a plain `.js` file is module or script as its
 * syntax says, and everything else is a module.
 */
export const parseOptionsOf = (path: string): ParseOptions => {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return {
    lang: LANGUAGE_BY_EXTENSION.get(extension) ?? "jsx",
    sourceType: SOURCE_TYPE_BY_EXTENSION.get(extension) ?? "module",
  };
};
