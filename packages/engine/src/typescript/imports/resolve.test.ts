import { describe, expect, it } from "vitest";

import { loadedConfig } from "../../testing/tsconfig.js";
import type { PackageManifest } from "../ecosystem/read-manifests.js";
import { createResolver } from "./resolve.js";
import type { Resolution } from "./resolve.js";
import { aliasesOf } from "./ts-aliases.js";

const manifest = (
  path: string,
  name: string,
  entry: Partial<PackageManifest["entry"]> = {},
): PackageManifest => ({
  path,
  name,
  type: null,
  dependencies: [],
  devDependencies: [],
  peerDependencies: [],
  typescript: null,
  entry: { exports: undefined, fields: [], ...entry },
});

const file = (path: string): Resolution => ({ kind: "file", path });
const EXTERNAL: Resolution = { kind: "external" };
const UNRESOLVED: Resolution = { kind: "unresolved" };

const resolverOver = (
  files: ReadonlyArray<string>,
  options: {
    readonly manifests?: ReadonlyArray<PackageManifest>;
    readonly config?: Parameters<typeof loadedConfig>[1];
  } = {},
) => {
  const aliases = aliasesOf(loadedConfig("tsconfig.json", options.config));
  return createResolver({
    files: new Set(files),
    manifests: options.manifests ?? [],
    aliasesFor: () => aliases,
  });
};

describe("relative specifiers", () => {
  const resolve = resolverOver([
    "src/a.ts",
    "src/b.ts",
    "src/dir/index.ts",
    "src/util/x.mts",
  ]);

  it("resolves a .js import to the .ts source", () => {
    expect(resolve("src/b.ts", "./a.js")).toStrictEqual(file("src/a.ts"));
    expect(resolve("src/b.ts", "./util/x.mjs")).toStrictEqual(
      file("src/util/x.mts"),
    );
  });

  it("resolves a directory to its index and an extensionless file to its source", () => {
    expect(resolve("src/a.ts", "./dir")).toStrictEqual(
      file("src/dir/index.ts"),
    );
    expect(resolve("src/dir/index.ts", "..")).toStrictEqual(UNRESOLVED);
    expect(resolve("src/a.ts", "./b")).toStrictEqual(file("src/b.ts"));
  });

  it("ignores a query or fragment", () => {
    expect(resolve("src/b.ts", "./a.js?raw")).toStrictEqual(file("src/a.ts"));
  });

  it("calls a missing file unresolved and a missing asset an asset", () => {
    expect(resolve("src/a.ts", "./missing.js")).toStrictEqual(UNRESOLVED);
    expect(resolve("src/a.ts", "./styles.css")).toStrictEqual({
      kind: "asset",
    });
    expect(resolve("src/a.ts", "./data.json")).toStrictEqual({ kind: "asset" });
  });
});

describe("workspace packages", () => {
  it("resolves a workspace package through a subpath export, mapping its build output to the source", () => {
    const resolve = resolverOver(
      [
        "packages/core/src/index.ts",
        "packages/core/src/sub/thing.ts",
        "apps/web/main.ts",
      ],
      {
        manifests: [
          manifest("packages/core/package.json", "@acme/core", {
            exports: {
              ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
              "./sub/*": { import: "./dist/sub/*.js" },
            },
          }),
        ],
      },
    );

    expect(resolve("apps/web/main.ts", "@acme/core")).toStrictEqual(
      file("packages/core/src/index.ts"),
    );
    expect(resolve("apps/web/main.ts", "@acme/core/sub/thing")).toStrictEqual(
      file("packages/core/src/sub/thing.ts"),
    );
  });

  it("resolves sources that lie beside their build output", () => {
    const resolve = resolverOver(["svc/api/index.ts", "app/main.ts"], {
      manifests: [
        manifest("svc/package.json", "svc", {
          exports: { "./api": { default: "./dist/api/index.js" } },
        }),
      ],
    });

    expect(resolve("app/main.ts", "svc/api")).toStrictEqual(
      file("svc/api/index.ts"),
    );
  });
});

describe("workspace package fallbacks", () => {
  it("falls back to main fields and then src/index for a package without exports", () => {
    const resolve = resolverOver(
      ["lib/a/src/index.ts", "lib/b/entry.ts", "app/main.ts"],
      {
        manifests: [
          manifest("lib/a/package.json", "a"),
          manifest("lib/b/package.json", "b", { fields: ["./entry.js"] }),
        ],
      },
    );

    expect(resolve("app/main.ts", "a")).toStrictEqual(
      file("lib/a/src/index.ts"),
    );
    expect(resolve("app/main.ts", "b")).toStrictEqual(file("lib/b/entry.ts"));
  });

  it("leaves a workspace subpath that nothing maps unresolved, and never guesses", () => {
    const resolve = resolverOver(
      ["lib/src/index.ts", "lib/src/hidden.ts", "app/main.ts"],
      {
        manifests: [
          manifest("lib/package.json", "lib", {
            exports: { ".": "./src/index.ts" },
          }),
        ],
      },
    );

    expect(resolve("app/main.ts", "lib/hidden")).toStrictEqual(UNRESOLVED);
    expect(resolve("app/main.ts", "lib/nothing")).toStrictEqual(UNRESOLVED);
  });
});

describe("paths and baseUrl", () => {
  it("resolves a paths alias, and leaves a specific alias that points at nothing unresolved", () => {
    const resolve = resolverOver(["src/lib/format.ts", "src/main.ts"], {
      config: { options: { baseUrl: ".", paths: { "@app/*": ["src/*"] } } },
    });

    expect(resolve("src/main.ts", "@app/lib/format")).toStrictEqual(
      file("src/lib/format.ts"),
    );
    expect(resolve("src/main.ts", "@app/lib/missing")).toStrictEqual(
      UNRESOLVED,
    );
  });

  it("resolves a bare path through baseUrl, and takes any other bare name for a package outside", () => {
    const resolve = resolverOver(["src/util/x.ts", "src/main.ts"], {
      config: { options: { baseUrl: "src" } },
    });

    expect(resolve("src/main.ts", "util/x")).toStrictEqual(
      file("src/util/x.ts"),
    );
    expect(resolve("src/main.ts", "react-dom/client")).toStrictEqual(EXTERNAL);
  });

  it("treats a catch-all paths pattern that finds no file as a package outside", () => {
    const resolve = resolverOver(["src/main.ts"], {
      config: { options: { paths: { "*": ["types/*"] } } },
    });

    expect(resolve("src/main.ts", "lodash")).toStrictEqual(EXTERNAL);
  });
});

describe("specifiers that leave the repository", () => {
  it("counts built-ins and other schemes as outside, and # imports and absolute paths as unresolved", () => {
    const resolve = resolverOver(["src/main.ts"]);

    expect(resolve("src/main.ts", "node:fs")).toStrictEqual(EXTERNAL);
    expect(resolve("src/main.ts", "https://esm.sh/x")).toStrictEqual(EXTERNAL);
    expect(resolve("src/main.ts", "npm:chalk")).toStrictEqual(EXTERNAL);
    expect(resolve("src/main.ts", "#internal/x")).toStrictEqual(UNRESOLVED);
    expect(resolve("src/main.ts", "/src/main.ts")).toStrictEqual(UNRESOLVED);
  });
});
