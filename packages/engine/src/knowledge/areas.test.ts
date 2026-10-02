import { describe, it } from "vitest";

describe("packageRootsOf", () => {
  it.todo("finds the directory of every manifest kind the glossary lists");
  it.todo("includes the repository root when it holds a manifest");
  it.todo("returns nothing for a repository without manifests");
});

describe("areaLevels", () => {
  it.todo("puts every universe file into exactly one area at every level");
  it.todo("makes level 1 the package roots when there are packages");
  it.todo("makes level 1 the top-level directories without packages");
  it.todo("anchors level 1 below the scope for a scoped analysis");
  it.todo(
    "puts apps/ui/index.ts and apps/ui/src/test.ts into one area at level 1",
  );
  it.todo(
    "splits a package root into one area per directory step at each deeper level",
  );
  it.todo("keeps the files directly in a package root as that root's own area");
  it.todo("groups areas under 3 files per parent as one rest area");
  it.todo("keeps a rest area below 3 files, so no file is left out");
  it.todo("stops at the level after which no area changes");
  it.todo("stops at level 6 in a deeper tree");
  it.todo("returns level 1 with no areas for no files");
  it.todo("orders areas riskiest first and reports the kind of each");
});
