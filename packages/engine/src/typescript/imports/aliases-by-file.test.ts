import { describe, expect, it } from "vitest";

import { loadedConfig } from "../../testing/tsconfig.js";
import { aliasesByFile } from "./aliases-by-file.js";

const root = loadedConfig("tsconfig.json", {
  options: { paths: { "@/*": ["src/*"] } },
});
const app = loadedConfig("apps/web/tsconfig.json", {
  options: { paths: { "~/*": ["lib/*"] } },
});
const build = loadedConfig("apps/web/tsconfig.build.json");

describe("aliasesByFile", () => {
  const aliasesFor = aliasesByFile([root, app, build], (path) =>
    path === "apps/web/src/a.ts" ? "apps/web/tsconfig.build.json" : undefined,
  );

  it("takes the aliases of the governing config", () => {
    expect(aliasesFor("apps/web/src/a.ts")?.patterns).toStrictEqual([]);
  });

  it("takes the nearest config above a file that no config governs, a plain tsconfig.json before others", () => {
    expect(aliasesFor("apps/web/scripts/run.ts")?.patterns).toStrictEqual([
      { pattern: "~/*", targets: ["apps/web/lib/*"] },
    ]);
    expect(aliasesFor("tools/run.ts")?.patterns).toStrictEqual([
      { pattern: "@/*", targets: ["src/*"] },
    ]);
  });

  it("has no aliases for a file above every config", () => {
    expect(
      aliasesByFile([app], () => undefined)("tools/run.ts"),
    ).toBeUndefined();
  });
});
