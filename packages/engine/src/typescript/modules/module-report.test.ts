import { describe, expect, it } from "vitest";

import { factsWith } from "../../testing/file-facts.js";
import type { PackageManifest } from "../ecosystem/read-manifests.js";
import type { IdiomFacts } from "../idioms/idiom-facts.js";
import type { ParsedFile } from "../parsed-file.js";
import type { ModuleFacts } from "./module-facts.js";
import { esmShareOf, modulesOf } from "./module-report.js";

const file = (
  path: string,
  modules: Partial<ModuleFacts>,
  idioms: Partial<IdiomFacts> = {},
): ParsedFile => ({ path, lines: 10, facts: factsWith({ modules, idioms }) });

const manifest = (type: PackageManifest["type"]): PackageManifest => ({
  path: "package.json",
  name: null,
  type,
  dependencies: [],
  devDependencies: [],
  peerDependencies: [],
  typescript: null,
  entry: { exports: undefined, fields: [] },
});

describe("modulesOf", () => {
  const files = [
    file("a.ts", { esm: 3, imports: 2, typeImports: 1 }, { enums: 1 }),
    file("b.cjs", { commonjs: 2 }),
    file(
      "c.ts",
      { esm: 1, commonjs: 1, imports: 1 },
      { decorators: 2, namespaces: 1 },
    ),
    file("d.js", {}),
  ];

  it("counts files by module system, a file with both in both, and a file with neither in neither", () => {
    expect(modulesOf(files, [])).toMatchObject({
      files: 4,
      esmFiles: 2,
      commonjsFiles: 2,
      bothFiles: 1,
    });
  });

  it("counts import declarations and those that bind only types", () => {
    expect(modulesOf(files, []).imports).toStrictEqual({
      declarations: 3,
      typeOnly: 1,
    });
  });

  it("counts the files and the uses of syntax Node cannot strip", () => {
    expect(modulesOf(files, []).nonErasable).toStrictEqual({
      files: 2,
      enums: 1,
      namespaces: 1,
      parameterProperties: 0,
      decorators: 2,
    });
  });

  it("counts the package manifests by type, no type apart", () => {
    expect(
      modulesOf(files, [manifest("module"), manifest(null), manifest("module")])
        .packageTypes,
    ).toStrictEqual({ module: 2, commonjs: 0, unspecified: 1 });
  });
});

describe("esmShareOf", () => {
  it("is the ESM files over the files that use a module system", () => {
    expect(
      esmShareOf([
        file("a.ts", { esm: 1 }),
        file("b.ts", { esm: 1 }),
        file("c.cjs", { commonjs: 1 }),
        file("d.js", {}),
      ]),
    ).toBe(0.6667);
  });

  it("is undefined when no file uses a module system", () => {
    expect(esmShareOf([file("a.js", {})])).toBeUndefined();
    expect(esmShareOf([])).toBeUndefined();
  });
});
