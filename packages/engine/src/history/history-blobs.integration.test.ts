import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";

// Ten distinct lines keep a file similar enough for git to detect a rename
// after one appended line.
const tenLines = Array.from(
  { length: 10 },
  (_, index) => `line ${index}\n`,
).join("");

const history = (repo: TempRepository) =>
  Effect.gen(function* () {
    const head = (yield* repo.git("rev-parse", "HEAD")).trim();
    const { commits } = yield* readHistory({
      root: repo.directory,
      head,
      shallowBoundary: new Set(),
      useCache: false,
    });
    return commits;
  }).pipe(Effect.provide(Git.layer(repo.directory)));

const blobAt = (repo: TempRepository, revision: string, path: string) =>
  repo
    .git("rev-parse", `${revision}:${path}`)
    .pipe(Effect.map((id) => id.trim()));

layer(NodeServices.layer)("readHistory blob ids", (it) => {
  it.effect(
    "gives each change the full ids git reports for the file before and after the commit",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "one\n" });
        yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "one\ntwo\n" });
        yield* repo.git("rm", "a.ts");
        yield* repo.commit("2026-03-03T12:00:00Z");

        const [deleted, edited, added] = yield* history(repo);

        const first = yield* blobAt(repo, "HEAD~2", "a.ts");
        const second = yield* blobAt(repo, "HEAD~1", "a.ts");
        assert.strictEqual(first.length, 40);
        assert.deepStrictEqual(added?.changes[0], {
          path: "a.ts",
          added: 1,
          deleted: 0,
          oid: first,
          mode: "100644",
          previousLife: true,
        });
        assert.deepStrictEqual(edited?.changes[0], {
          path: "a.ts",
          added: 1,
          deleted: 0,
          oid: second,
          previousOid: first,
          mode: "100644",
          previousMode: "100644",
          previousLife: true,
        });
        assert.deepStrictEqual(deleted?.changes[0], {
          path: "a.ts",
          added: 0,
          deleted: 2,
          previousOid: second,
          previousMode: "100644",
          previousLife: true,
        });
      }),
  );
});

layer(NodeServices.layer)("readHistory blob ids and renames", (it) => {
  it.effect(
    "keeps the ids of a file renamed twice under its current path",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": tenLines });
        yield* repo.git("mv", "a.ts", "b.ts");
        yield* repo.commit("2026-03-02T12:00:00Z");
        yield* repo.commit("2026-03-03T12:00:00Z", {
          "b.ts": `${tenLines}two\n`,
        });
        yield* repo.git("mv", "b.ts", "c.ts");
        yield* repo.commit("2026-03-04T12:00:00Z");

        const [secondMove, edit, firstMove, created] = yield* history(repo);

        const original = yield* blobAt(repo, "HEAD~3", "a.ts");
        const edited = yield* blobAt(repo, "HEAD", "c.ts");
        assert.deepStrictEqual(
          [created, firstMove, edit, secondMove].map((commit) => [
            commit?.changes[0]?.path,
            commit?.changes[0]?.previousOid,
            commit?.changes[0]?.oid,
          ]),
          [
            ["c.ts", undefined, original],
            ["c.ts", original, original],
            ["c.ts", original, edited],
            ["c.ts", edited, edited],
          ],
        );
      }),
  );
});

layer(NodeServices.layer)("readHistory modes", (it) => {
  it.effect("reports the mode of a symlink and of an executable file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "run.sh": "echo\n" });
      yield* fs.chmod(path.join(repo.directory, "run.sh"), 0o755);
      yield* fs.symlink("run.sh", path.join(repo.directory, "link.ts"));
      yield* repo.commit("2026-03-02T12:00:00Z");

      const [commit] = yield* history(repo);

      assert.deepStrictEqual(
        commit?.changes.map(({ path: file, mode, previousMode }) => [
          file,
          previousMode,
          mode,
        ]),
        [
          ["link.ts", undefined, "120000"],
          ["run.sh", "100644", "100755"],
        ],
      );
    }),
  );

  it.effect("tells a symlink that becomes a file by its previous mode", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* makeTempRepository;
      const link = path.join(repo.directory, "a.ts");
      yield* fs.symlink("elsewhere", link);
      yield* repo.commit("2026-03-01T12:00:00Z");
      yield* fs.remove(link);
      yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "export {};\n" });

      const [commit] = yield* history(repo);

      assert.deepStrictEqual(
        [commit?.changes[0]?.previousMode, commit?.changes[0]?.mode],
        ["120000", "100644"],
      );
    }),
  );
});
