// Owns turning the module facts of many files into the report's block, and the ES module share of a territory.
// File counts are over parsed files; a file that uses both module systems is in both counts.

import type { Modules } from "../../report/typescript-modules.js";
import { ratioOf, sum } from "../../stats/measures.js";
import type { PackageManifest } from "../ecosystem/read-manifests.js";
import type { ParsedFile } from "../parsed-file.js";

const isEsm = ({ facts }: ParsedFile): boolean => facts.modules.esm > 0;
const isCommonjs = ({ facts }: ParsedFile): boolean =>
  facts.modules.commonjs > 0;

const usesNonErasable = ({ facts: { idioms } }: ParsedFile): boolean =>
  idioms.enums +
    idioms.namespaces +
    idioms.parameterProperties +
    idioms.decorators >
  0;

const totalOf = (
  files: ReadonlyArray<ParsedFile>,
  count: (file: ParsedFile) => number,
): number => sum(files.map((file) => count(file)));

/** The module systems of `files`, and the `package.json` types of `manifests`. */
export const modulesOf = (
  files: ReadonlyArray<ParsedFile>,
  manifests: ReadonlyArray<PackageManifest>,
): Modules => ({
  files: files.length,
  esmFiles: files.filter((file) => isEsm(file)).length,
  commonjsFiles: files.filter((file) => isCommonjs(file)).length,
  bothFiles: files.filter((file) => isEsm(file) && isCommonjs(file)).length,
  imports: {
    declarations: totalOf(files, ({ facts }) => facts.modules.imports),
    typeOnly: totalOf(files, ({ facts }) => facts.modules.typeImports),
  },
  nonErasable: {
    files: files.filter((file) => usesNonErasable(file)).length,
    enums: totalOf(files, ({ facts }) => facts.idioms.enums),
    namespaces: totalOf(files, ({ facts }) => facts.idioms.namespaces),
    parameterProperties: totalOf(
      files,
      ({ facts }) => facts.idioms.parameterProperties,
    ),
    decorators: totalOf(files, ({ facts }) => facts.idioms.decorators),
  },
  packageTypes: {
    module: manifests.filter(({ type }) => type === "module").length,
    commonjs: manifests.filter(({ type }) => type === "commonjs").length,
    unspecified: manifests.filter(({ type }) => type === null).length,
  },
});

/**
 * The files with ESM syntax over the files with ESM syntax and the files
 * with CommonJS, undefined when no file uses either.
 */
export const esmShareOf = (
  files: ReadonlyArray<ParsedFile>,
): number | undefined => {
  const esm = files.filter((file) => isEsm(file)).length;
  const commonjs = files.filter((file) => isCommonjs(file)).length;
  return esm + commonjs === 0 ? undefined : ratioOf(esm, esm + commonjs);
};
