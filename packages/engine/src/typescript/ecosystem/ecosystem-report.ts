// Owns turning imports and manifests into the report's ecosystem block.
// Imports are counted per file; the table decides which package means which tool.

import type { Ecosystem } from "../../report/typescript-ecosystem.js";
import { sum } from "../../stats/measures.js";
import type { ParsedFile } from "../parsed-file.js";
import { ECOSYSTEM_TABLE } from "./ecosystem-table.js";
import type { EcosystemEntry } from "./ecosystem-table.js";
import { classifySpecifier, tableKeyOf } from "./package-name.js";
import type { PackageManifest } from "./read-manifests.js";

const MAX_LISTED = 10;

const EXACT = new Map(
  ECOSYSTEM_TABLE.flatMap((entry) =>
    entry.packages
      .filter((name) => !name.endsWith("/*"))
      .map((name): [string, EcosystemEntry] => [name, entry]),
  ),
);
const SCOPES = ECOSYSTEM_TABLE.flatMap((entry) =>
  entry.packages
    .filter((name) => name.endsWith("/*"))
    .map((name): [string, EcosystemEntry] => [name.slice(0, -1), entry]),
);

/** The table's tool for a package name, undefined where it names none. */
const toolOf = (name: string): EcosystemEntry | undefined =>
  EXACT.get(name) ?? SCOPES.find(([prefix]) => name.startsWith(prefix))?.[1];

const increment = <Key>(counts: Map<Key, number>, key: Key): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

const incrementAll = <Key>(
  counts: Map<Key, number>,
  keys: Iterable<Key>,
): void => {
  for (const key of keys) {
    increment(counts, key);
  }
};

type Counted = ReadonlyMap<string, number>;

/** What the files import: for each package, built-in and tool, how many files import it, and the names no manifest declares. */
type Imports = {
  readonly packages: Counted;
  readonly builtins: Counted;
  readonly tools: ReadonlyMap<EcosystemEntry, number>;
  readonly undeclared: ReadonlySet<string>;
};

/** The package names the manifests declare in any section and the workspace packages they name. */
const knownPackages = (
  manifests: ReadonlyArray<PackageManifest>,
): ReadonlySet<string> =>
  new Set(
    manifests.flatMap((manifest) => [
      ...(manifest.name === null ? [] : [manifest.name]),
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    ]),
  );

const importsOf = (
  files: ReadonlyArray<ParsedFile>,
  known: ReadonlySet<string>,
): Imports => {
  const packages = new Map<string, number>();
  const builtins = new Map<string, number>();
  const tools = new Map<EcosystemEntry, number>();
  const undeclared = new Set<string>();
  for (const { facts } of files) {
    const specifiers = new Set(
      facts.modules.requests.map(({ specifier }) => specifier),
    );
    const names = new Set<string>();
    const builtinNames = new Set<string>();
    const toolsHere = new Set<EcosystemEntry>();
    for (const specifier of specifiers) {
      const target = classifySpecifier(specifier, known);
      const key = tableKeyOf(specifier);
      const tool = key === undefined ? undefined : toolOf(key);
      if (tool !== undefined) {
        toolsHere.add(tool);
      }
      if (target?.kind === "package") {
        names.add(target.name);
      } else if (target?.kind === "builtin") {
        builtinNames.add(target.name);
      } else if (target?.kind === "undeclared") {
        undeclared.add(target.name);
      }
    }
    incrementAll(packages, names);
    incrementAll(builtins, builtinNames);
    incrementAll(tools, toolsHere);
  }
  return { packages, builtins, tools, undeclared };
};

/** For each tool, how many manifests declare any of its packages. */
const declarationsOf = (
  manifests: ReadonlyArray<PackageManifest>,
): ReadonlyMap<EcosystemEntry, number> => {
  const declared = new Map<EcosystemEntry, number>();
  for (const manifest of manifests) {
    const tools = new Set(
      [
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.peerDependencies,
      ].flatMap((name) => toolOf(name) ?? []),
    );
    incrementAll(declared, tools);
  }
  return declared;
};

const byFilesThenName = (
  left: { readonly files: number; readonly name: string },
  right: { readonly files: number; readonly name: string },
): number =>
  right.files - left.files ||
  Number(left.name > right.name) - Number(left.name < right.name);

const top = (counts: Counted): Ecosystem["packages"] =>
  [...counts]
    .map(([name, files]) => ({ name, files }))
    .toSorted(byFilesThenName)
    .slice(0, MAX_LISTED);

const distinct = (lists: ReadonlyArray<ReadonlyArray<string>>): number =>
  new Set(lists.flat()).size;

/** The ecosystem of the parsed files and the manifests read. */
export const ecosystemOf = (
  files: ReadonlyArray<ParsedFile>,
  manifests: ReadonlyArray<PackageManifest>,
): Ecosystem => {
  const imports = importsOf(files, knownPackages(manifests));
  const declared = declarationsOf(manifests);
  const detected = ECOSYSTEM_TABLE.map((entry) => ({
    name: entry.name,
    category: entry.category,
    files: imports.tools.get(entry) ?? 0,
    declaredIn: declared.get(entry) ?? 0,
  })).filter(({ files: importing, declaredIn }) => importing + declaredIn > 0);
  const hookFiles = files.filter(({ facts }) => facts.ecosystem.hookCalls > 0);
  return {
    tools: detected.toSorted(
      (left, right) =>
        right.files - left.files ||
        right.declaredIn - left.declaredIn ||
        Number(left.name > right.name) - Number(left.name < right.name),
    ),
    packages: top(imports.packages),
    undeclared: imports.undeclared.size,
    nodeBuiltins: top(imports.builtins),
    dependencies: {
      manifests: manifests.length,
      runtime: distinct(manifests.map(({ dependencies }) => dependencies)),
      dev: distinct(manifests.map(({ devDependencies }) => devDependencies)),
    },
    hooks: {
      calls: sum(files.map(({ facts }) => facts.ecosystem.hookCalls)),
      files: hookFiles.length,
    },
  };
};
