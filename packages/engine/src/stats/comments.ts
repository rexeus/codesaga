// Owns telling comment lines from code lines, by the comment syntax of a language family.
// Deliberately simple: only a comment that begins a line counts, so a trailing comment leaves its line a code line.
// Languages without a listed syntax count no comment lines.

/** The markers a language family starts comments with. */
export type CommentSyntax = {
  /** Markers after which the rest of the line is a comment: `//`, `#`, `--`. */
  readonly line: ReadonlyArray<string>;
  /** Opening and closing markers of comments that span lines, C-style and HTML. */
  readonly block: ReadonlyArray<readonly [open: string, close: string]>;
};

const C_BLOCK = ["/*", "*/"] as const;
const HTML_BLOCK = ["<!--", "-->"] as const;

const NONE: CommentSyntax = { line: [], block: [] };
const SLASH: CommentSyntax = { line: ["//"], block: [C_BLOCK] };
const SLASH_HASH: CommentSyntax = { line: ["//", "#"], block: [C_BLOCK] };
const MARKUP: CommentSyntax = { line: ["//"], block: [C_BLOCK, HTML_BLOCK] };
const HASH: CommentSyntax = { line: ["#"], block: [] };
const DASH: CommentSyntax = { line: ["--"], block: [] };
const SQL: CommentSyntax = { line: ["--"], block: [C_BLOCK] };
const CSS: CommentSyntax = { line: [], block: [C_BLOCK] };
const HTML: CommentSyntax = { line: [], block: [HTML_BLOCK] };

const SYNTAX_OF_LANGUAGES: ReadonlyArray<
  readonly [CommentSyntax, ReadonlyArray<string>]
> = [
  [
    SLASH,
    [
      "TypeScript",
      "JavaScript",
      "C",
      "C++",
      "Rust",
      "Go",
      "Zig",
      "Java",
      "Kotlin",
      "Scala",
      "Groovy",
      "C#",
      "F#",
      "Swift",
      "Objective-C",
      "Dart",
      "Solidity",
      "Protocol Buffers",
      "SCSS",
      "Less",
    ],
  ],
  [SLASH_HASH, ["PHP", "Terraform"]],
  [MARKUP, ["Vue", "Svelte", "Astro"]],
  [
    HASH,
    [
      "Python",
      "Ruby",
      "Perl",
      "R",
      "Julia",
      "Shell",
      "PowerShell",
      "Elixir",
      "GraphQL",
    ],
  ],
  [DASH, ["Lua", "Haskell", "Elm"]],
  [SQL, ["SQL"]],
  [CSS, ["CSS"]],
  [HTML, ["HTML"]],
];

const SYNTAX_BY_LANGUAGE: ReadonlyMap<string, CommentSyntax> = new Map(
  SYNTAX_OF_LANGUAGES.flatMap(([syntax, languages]) =>
    languages.map((language) => [language, syntax] as const),
  ),
);

/** The comment syntax of a language name; none for an unknown language or one without a listed syntax. */
export const commentSyntaxOf = (language: string | undefined): CommentSyntax =>
  (language === undefined ? undefined : SYNTAX_BY_LANGUAGE.get(language)) ??
  NONE;

/** Counts the comment lines of the non-blank lines of one file, fed in order. */
export type CommentCounter = {
  /** Feeds the next non-blank line, whose first character other than a tab or a space is at `start`. */
  readonly add: (line: string, start: number) => void;
  /** The comment lines so far. */
  readonly count: () => number;
};

/**
 * A counter for `syntax`. A line is a comment line when it starts with a line
 * marker (a shebang is not one) or a block opener, and so is every line up to
 * and including the one that closes the block.
 */
export const commentCounter = (syntax: CommentSyntax): CommentCounter => {
  const openers = new Set(
    [...syntax.line, ...syntax.block.map(([open]) => open)].map((marker) =>
      marker.codePointAt(0),
    ),
  );
  let count = 0;
  let closer: string | undefined;
  const add = (line: string, start: number): void => {
    if (closer !== undefined) {
      count += 1;
      closer = line.includes(closer, start) ? undefined : closer;
      return;
    }
    if (!openers.has(line.codePointAt(start))) {
      return;
    }
    const block = syntax.block.find(([open]) => line.startsWith(open, start));
    if (block !== undefined) {
      count += 1;
      closer = line.includes(block[1], start + block[0].length)
        ? undefined
        : block[1];
    } else if (
      !line.startsWith("#!", start) &&
      syntax.line.some((marker) => line.startsWith(marker, start))
    ) {
      count += 1;
    }
  };
  return { add, count: () => count };
};
