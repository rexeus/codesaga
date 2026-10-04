import { describe, expect, it } from "vitest";

import { sourceFileOf, withoutScriptExtension } from "./source-file.js";

const among =
  (...files: ReadonlyArray<string>) =>
  (path: string): boolean =>
    files.includes(path);

describe("sourceFileOf", () => {
  it("maps an import with the extension of the output to the source file", () => {
    expect(sourceFileOf("src/a.js", among("src/a.ts"))).toBe("src/a.ts");
    expect(sourceFileOf("src/a.mjs", among("src/a.mts"))).toBe("src/a.mts");
    expect(sourceFileOf("src/a.cjs", among("src/a.cts"))).toBe("src/a.cts");
    expect(sourceFileOf("src/a.jsx", among("src/a.tsx"))).toBe("src/a.tsx");
  });

  it("prefers the file as written over its mapped source", () => {
    expect(sourceFileOf("src/a.js", among("src/a.ts", "src/a.js"))).toBe(
      "src/a.js",
    );
  });

  it("finds an extensionless import by appending extensions, TypeScript first", () => {
    expect(sourceFileOf("src/a", among("src/a.js", "src/a.tsx"))).toBe(
      "src/a.tsx",
    );
    expect(sourceFileOf("src/a", among("src/a.d.ts"))).toBe("src/a.d.ts");
  });

  it("finds the index file of a directory, and of the root", () => {
    expect(sourceFileOf("src/dir", among("src/dir/index.ts"))).toBe(
      "src/dir/index.ts",
    );
    expect(sourceFileOf("", among("index.js"))).toBe("index.js");
  });

  it("keeps a dot in the name of a file with no script extension", () => {
    expect(sourceFileOf("src/a.config", among("src/a.config.ts"))).toBe(
      "src/a.config.ts",
    );
  });

  it("finds nothing for a file that does not exist", () => {
    expect(sourceFileOf("src/missing", among("src/a.ts"))).toBeUndefined();
  });
});

describe("withoutScriptExtension", () => {
  it("drops script and declaration extensions and nothing else", () => {
    expect(withoutScriptExtension("dist/a.js")).toBe("dist/a");
    expect(withoutScriptExtension("dist/a.d.ts")).toBe("dist/a");
    expect(withoutScriptExtension("dist/a.d.mts")).toBe("dist/a");
    expect(withoutScriptExtension("dist/a.json")).toBe("dist/a.json");
    expect(withoutScriptExtension("dist/.hidden")).toBe("dist/.hidden");
  });
});
