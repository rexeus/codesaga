// Owns turning the path an import names into the source file it means, among the files the analysis knows.
// TypeScript names a file by the extension of its output, so `./a.js` can be `a.ts`; a directory means its `index` file.

const TYPESCRIPT_FOR: ReadonlyMap<string, ReadonlyArray<string>> = new Map([
  [".js", [".ts", ".tsx", ".d.ts"]],
  [".jsx", [".tsx"]],
  [".mjs", [".mts", ".d.mts"]],
  [".cjs", [".cts", ".d.cts"]],
]);

const APPENDED = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".d.ts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

const extensionOf = (path: string): string => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot);
};

/** The path without a script extension, `.d.ts` and the like included; unchanged when it has none. */
export const withoutScriptExtension = (path: string): string => {
  const extension = extensionOf(path);
  const known = [...TYPESCRIPT_FOR.keys(), ...APPENDED].includes(extension);
  if (!known) {
    return path;
  }
  const bare = path.slice(0, path.length - extension.length);
  return bare.endsWith(".d") ? bare.slice(0, -2) : bare;
};

/** The files `base` may mean as a file, best first: as written, with its extension mapped to the source's, then with an extension appended. */
const fileCandidates = (base: string): ReadonlyArray<string> => {
  const extension = extensionOf(base);
  const mapped = (TYPESCRIPT_FOR.get(extension) ?? []).map(
    (mappedExtension) =>
      `${base.slice(0, base.length - extension.length)}${mappedExtension}`,
  );
  return [base, ...mapped, ...APPENDED.map((appended) => `${base}${appended}`)];
};

const indexCandidates = (base: string): ReadonlyArray<string> => {
  const directory = base === "" ? "index" : `${base}/index`;
  return APPENDED.map((extension) => `${directory}${extension}`);
};

/**
 * The first of the files `base` may mean that `has` knows: `./a.js` is `a.ts`
 * (or `a.tsx`, `a.d.ts`) when only that exists, `./a` is `a.ts`, and a
 * directory is the file its own `package.json` names, which `entryOf` finds
 * from the directory, else its `index` file. Undefined when none exists.
 */
export const sourceFileOf = (
  base: string,
  has: (path: string) => boolean,
  entryOf?: (directory: string) => string | undefined,
): string | undefined =>
  fileCandidates(base).find((candidate) => has(candidate)) ??
  entryOf?.(base) ??
  indexCandidates(base).find((candidate) => has(candidate));
