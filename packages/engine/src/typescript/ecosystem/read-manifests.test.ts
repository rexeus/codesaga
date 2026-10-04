import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { readManifests } from "./read-manifests.js";

/** A temporary directory holding `files`, deleted with the scope. */
const directoryWith = (files: Readonly<Record<string, string>>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "codesaga-" });
    for (const [file, text] of Object.entries(files)) {
      yield* fs.makeDirectory(path.dirname(path.join(root, file)), {
        recursive: true,
      });
      yield* fs.writeFileString(path.join(root, file), text);
    }
    return root;
  });

layer(NodeServices.layer)("readManifests", (it) => {
  it.effect(
    "reads the name, the type and the dependency names, leaving out workspace links",
    () =>
      Effect.gen(function* () {
        const root = yield* directoryWith({
          "packages/a/package.json": JSON.stringify({
            name: "@acme/a",
            type: "module",
            dependencies: { react: "^19", "@acme/b": "workspace:*" },
            optionalDependencies: { fsevents: "^2" },
            devDependencies: { vitest: "^3", typescript: "^5.9" },
            peerDependencies: { "react-dom": "^19" },
          }),
        });

        const manifests = yield* readManifests(root, [
          "packages/a/package.json",
        ]);

        assert.deepStrictEqual(manifests, [
          {
            path: "packages/a/package.json",
            name: "@acme/a",
            type: "module",
            dependencies: ["react", "fsevents"],
            devDependencies: ["vitest", "typescript"],
            peerDependencies: ["react-dom"],
            typescript: "^5.9",
            entry: { exports: undefined, imports: undefined, fields: [] },
          },
        ]);
      }),
  );

  it.effect(
    "reads a bare manifest and an unknown type as no name and no type",
    () =>
      Effect.gen(function* () {
        const root = yield* directoryWith({
          "package.json": '{ "type": "umd" }',
        });

        const manifests = yield* readManifests(root, ["package.json"]);

        assert.deepStrictEqual(manifests, [
          {
            path: "package.json",
            name: null,
            type: null,
            dependencies: [],
            devDependencies: [],
            peerDependencies: [],
            typescript: null,
            entry: { exports: undefined, imports: undefined, fields: [] },
          },
        ]);
      }),
  );
});

layer(NodeServices.layer)("readManifests skipping", (it) => {
  it.effect(
    "skips what is not a JSON object, a missing file, a test fixture and every other file",
    () =>
      Effect.gen(function* () {
        const root = yield* directoryWith({
          "a/package.json": "[]",
          "b/package.json": "not json",
          "test/fixture/package.json": '{ "name": "fixture" }',
          "d/package.json": '{ "name": "d" }',
          "d/tsconfig.json": "{}",
        });

        const manifests = yield* readManifests(root, [
          "a/package.json",
          "b/package.json",
          "c/package.json",
          "test/fixture/package.json",
          "d/package.json",
          "d/tsconfig.json",
        ]);

        assert.deepStrictEqual(
          manifests.map(({ path }) => path),
          ["d/package.json"],
        );
      }),
  );
});

layer(NodeServices.layer)("readManifests entry points", (it) => {
  it.effect(
    "reads the exports and imports fields and the entry fields in the order types, module, main",
    () =>
      Effect.gen(function* () {
        const root = yield* directoryWith({
          "package.json": JSON.stringify({
            main: "./dist/index.cjs",
            module: "./dist/index.js",
            types: "./dist/index.d.ts",
            exports: { ".": "./src/index.ts" },
            imports: { "#a": "./src/a.ts" },
          }),
        });

        const manifests = yield* readManifests(root, ["package.json"]);

        assert.deepStrictEqual(manifests[0]?.entry, {
          exports: { ".": "./src/index.ts" },
          imports: { "#a": "./src/a.ts" },
          fields: ["./dist/index.d.ts", "./dist/index.js", "./dist/index.cjs"],
        });
      }),
  );
});
