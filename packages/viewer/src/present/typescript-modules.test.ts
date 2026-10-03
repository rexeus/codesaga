import { describe, expect, it } from "vitest";

import { sampleBlock } from "../testing/reports.js";
import { moduleSegments, modulesView } from "./typescript-modules.js";

const modules = sampleBlock("modules");

describe("moduleSegments", () => {
  it("splits the files by module system, with those that use both apart", () => {
    // 312 ESM and 9 CommonJS files, 2 of them both, of 338
    expect(moduleSegments(modules)).toEqual([
      { label: "ES modules", files: 310, entity: "slot-1" },
      { label: "Both", files: 2, entity: "slot-3" },
      { label: "CommonJS", files: 7, entity: "slot-2" },
      { label: "Neither", files: 19, entity: "slot-other" },
    ]);
  });

  it("adds up to the files", () => {
    expect(
      moduleSegments(modules).reduce((sum, { files }) => sum + files, 0),
    ).toBe(modules.files);
  });

  it("leaves out a part with no file", () => {
    const segments = moduleSegments({
      ...modules,
      files: 10,
      esmFiles: 10,
      commonjsFiles: 0,
      bothFiles: 0,
    });

    expect(segments.map(({ label }) => label)).toEqual(["ES modules"]);
  });
});

describe("modulesView", () => {
  it("words the share of ES modules, the type-only imports and the package types", () => {
    const view = modulesView(modules);

    expect(view.teaser).toBe("92% of files are ES modules");
    expect(view.importLine).toBe("25% of 1,640 imports bind only types.");
    expect(view.packageLine).toBe(
      'package.json "type": 7 module, 1 commonjs, 3 unspecified (read as CommonJS).',
    );
  });

  it("says how many files need a build step", () => {
    expect(modulesView(modules).nonErasableLine).toBe(
      "6 of 338 files use syntax that Node's type stripping cannot erase, so they need a build step.",
    );
    expect(modulesView(modules).nonErasable).toEqual([
      { label: "Enums", count: "4" },
      { label: "Namespaces with code", count: "0" },
      { label: "Parameter properties", count: "9" },
      { label: "Decorators", count: "0" },
    ]);
  });

  it("says the code could run unbuilt when nothing needs erasing", () => {
    const view = modulesView({
      ...modules,
      nonErasable: {
        files: 0,
        enums: 0,
        namespaces: 0,
        parameterProperties: 0,
        decorators: 0,
      },
    });

    expect(view.nonErasableLine).toContain("could run unbuilt");
  });

  it("does not divide by no imports and names no manifest", () => {
    const view = modulesView({
      ...modules,
      imports: { declarations: 0, typeOnly: 0 },
      packageTypes: { module: 0, commonjs: 0, unspecified: 0 },
    });

    expect(view.importLine).toBe("No import declaration binds anything.");
    expect(view.packageLine).toBe("No package.json was read.");
  });
});
