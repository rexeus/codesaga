// Owns the default answer to "is this a source file?" and its language name: an allow-list.
// `--include` replaces the allow-list, so prose and data formats stay out unless asked for.

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
