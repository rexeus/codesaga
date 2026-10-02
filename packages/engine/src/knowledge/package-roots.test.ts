import { describe, expect, it } from "vitest";

import { packageRootsOf } from "./package-roots.js";

describe("packageRootsOf", () => {
  it("finds the directory of every manifest kind the glossary lists", () => {
    const manifests = [
      "js/package.json",
      "rust/Cargo.toml",
      "go/go.mod",
      "py/pyproject.toml",
      "legacy-py/setup.py",
      "java/pom.xml",
      "gradle/build.gradle",
      "kotlin/build.gradle.kts",
      "dotnet/App.csproj",
      "php/composer.json",
      "ruby/Gemfile",
      "elixir/mix.exs",
      "deno/deno.json",
      "deno-c/deno.jsonc",
    ];

    expect(packageRootsOf(manifests)).toStrictEqual([
      "deno",
      "deno-c",
      "dotnet",
      "elixir",
      "go",
      "gradle",
      "java",
      "js",
      "kotlin",
      "legacy-py",
      "php",
      "py",
      "ruby",
      "rust",
    ]);
  });

  it("includes the repository root when it holds a manifest", () => {
    expect(
      packageRootsOf(["package.json", "src/index.ts", "apps/web/package.json"]),
    ).toStrictEqual([".", "apps/web"]);
  });

  it("lists a directory once, however many manifests it holds", () => {
    expect(
      packageRootsOf(["app/package.json", "app/deno.json", "app/src/a.ts"]),
    ).toStrictEqual(["app"]);
  });

  it("returns nothing for a repository without manifests", () => {
    expect(
      packageRootsOf(["src/index.ts", "README.md", "docs/package.json.md"]),
    ).toStrictEqual([]);
  });
});
