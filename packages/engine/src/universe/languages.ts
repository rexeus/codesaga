// Owns the default answer to "is this a source file?" and its language name: an allow-list.
// `--include` replaces the allow-list, so prose and data formats stay out unless asked for.

import { Order } from "effect";

import { groupBy } from "../collections/group-by.js";

const LANGUAGE_EXTENSIONS: Readonly<Record<string, ReadonlyArray<string>>> = {
  // JavaScript family
  TypeScript: ["ts", "tsx", "mts", "cts"],
  JavaScript: ["js", "jsx", "mjs", "cjs"],
  Vue: ["vue"],
  Svelte: ["svelte"],
  Astro: ["astro"],
  // systems
  C: ["c", "h"],
  "C++": ["cc", "cpp", "cxx", "hpp", "hh"],
  Rust: ["rs"],
  Go: ["go"],
  Zig: ["zig"],
  // JVM and .NET
  Java: ["java"],
  Kotlin: ["kt", "kts"],
  Scala: ["scala"],
  Groovy: ["groovy"],
  "C#": ["cs"],
  "F#": ["fs"],
  // scripting
  Python: ["py"],
  Ruby: ["rb"],
  PHP: ["php"],
  Perl: ["pl"],
  Lua: ["lua"],
  R: ["r"],
  Julia: ["jl"],
  Shell: ["sh", "bash", "zsh"],
  PowerShell: ["ps1"],
  // functional and others
  Elixir: ["ex", "exs"],
  Erlang: ["erl"],
  Haskell: ["hs"],
  OCaml: ["ml"],
  Clojure: ["clj"],
  Elm: ["elm"],
  Swift: ["swift"],
  "Objective-C": ["m", "mm"],
  Dart: ["dart"],
  Solidity: ["sol"],
  // data and markup that hold logic
  SQL: ["sql"],
  GraphQL: ["graphql", "gql"],
  "Protocol Buffers": ["proto"],
  HTML: ["html"],
  CSS: ["css"],
  SCSS: ["scss"],
  Less: ["less"],
  Terraform: ["tf"],
};

const LANGUAGE_BY_EXTENSION: ReadonlyMap<string, string> = new Map(
  Object.entries(LANGUAGE_EXTENSIONS).flatMap(([language, extensions]) =>
    extensions.map((extension) => [extension, language] as const),
  ),
);

/**
 * The language name for the path's extension (case-insensitive), or
 * undefined when the extension is not on the allow-list.
 */
export const languageOf = (path: string): string | undefined => {
  const extensionStart = path.lastIndexOf(".");
  return extensionStart > path.lastIndexOf("/") + 1
    ? LANGUAGE_BY_EXTENSION.get(path.slice(extensionStart + 1).toLowerCase())
    : undefined;
};

/** Whether the path's extension belongs to a source language. */
export const isSourceLanguage = (path: string): boolean =>
  languageOf(path) !== undefined;

/** The language of files whose extension is not on the allow-list; only `--include` admits them. */
export const OTHER_LANGUAGE = "Other";

/** The language name of a path, "Other" for an extension that is not on the allow-list. */
export const languageNameOf = (path: string): string =>
  languageOf(path) ?? OTHER_LANGUAGE;

/** A language with its files and non-blank lines. */
export type LanguageShare = {
  readonly name: string;
  readonly files: number;
  readonly loc: number;
};

const byLinesThenName = Order.combine(
  Order.flip(
    Order.mapInput(Order.Number, (language: LanguageShare) => language.loc),
  ),
  Order.mapInput(Order.String, (language: LanguageShare) => language.name),
);

/**
 * The files grouped by language, most lines first, then by name. A file whose
 * extension is not on the allow-list belongs to "Other".
 */
export const languageBreakdown = (
  files: ReadonlyArray<{ readonly path: string; readonly loc: number }>,
): ReadonlyArray<LanguageShare> =>
  [...groupBy(files, (file) => languageNameOf(file.path))]
    .map(([name, group]) => ({
      name,
      files: group.length,
      loc: group.reduce((sum, file) => sum + file.loc, 0),
    }))
    .toSorted(byLinesThenName);
