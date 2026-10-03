import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readFirstParent } from "./first-parent.js";
import type { FirstParentCommit } from "./first-parent.js";

const lines = (count: number, tag: string) =>
  Array.from({ length: count }, (_, index) => `${tag} ${index}\n`).join("");

/** The files the commits leave behind when applied in order: path to blob id. */
const replayed = (commits: ReadonlyArray<FirstParentCommit>) => {
  const state = new Map<string, string>();
  for (const { changes } of commits) {
    for (const { path, oid } of changes) {
      if (oid === undefined) {
        state.delete(path);
      } else {
        state.set(path, oid);
      }
    }
  }
  return Object.fromEntries(
    [...state].toSorted(([left], [right]) => left.localeCompare(right)),
  );
};

/** `git ls-tree -r HEAD` as path to blob id. */
const treeOf = (repo: TempRepository) =>
  repo.git("ls-tree", "-r", "HEAD").pipe(
    Effect.map((listing) =>
      Object.fromEntries(
        listing
          .split("\n")
          .filter((line) => line !== "")
          .map((line): [string, string] => {
            const [meta = "", path = ""] = line.split("\t");
            return [path, meta.split(" ")[2] ?? ""];
          })
          .toSorted(([left], [right]) => left.localeCompare(right)),
      ),
    ),
  );

/** The first-parent chain of HEAD, and whether replaying it ends in HEAD's tree. */
const chainOf = (repo: TempRepository) =>
  Effect.gen(function* () {
    const chain = yield* readFirstParent("HEAD").pipe(
      Effect.provide(Git.layer(repo.directory)),
    );
    assert.deepStrictEqual(replayed(chain), yield* treeOf(repo));
    return chain;
  });

const mergeSide = (repo: TempRepository) =>
  repo.git("merge", "--no-ff", "--no-edit", "side");

layer(NodeServices.layer)("readFirstParent", (it) => {
  it.effect(
    "ends in the tree of HEAD after a clean merge of a rename and an edit",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "a.ts": lines(12, "base"),
        });
        yield* repo.git("checkout", "-q", "-b", "side");
        yield* repo.git("mv", "a.ts", "b.ts");
        yield* repo.commit("2026-03-02T12:00:00Z");
        yield* repo.git("checkout", "-q", "-");
        yield* repo.commit("2026-03-03T12:00:00Z", {
          "a.ts": `${lines(12, "base")}edit\n`,
        });
        yield* mergeSide(repo);

        const chain = yield* chainOf(repo);

        const merge = chain.at(-1);
        assert.deepStrictEqual(
          merge?.changes.map(({ path, oid }) => [path, oid === undefined]),
          [
            ["a.ts", true],
            ["b.ts", false],
          ],
        );
      }),
  );

  it.effect("ends in the tree of HEAD after a rename onto a deleted path", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "a.ts": lines(12, "old"),
        "b.ts": lines(12, "other"),
      });
      yield* repo.git("rm", "-q", "a.ts");
      yield* repo.commit("2026-03-02T12:00:00Z");
      yield* repo.git("mv", "-f", "b.ts", "a.ts");
      yield* repo.commit("2026-03-03T12:00:00Z");

      const chain = yield* chainOf(repo);

      assert.deepStrictEqual(Object.keys(replayed(chain)), ["a.ts"]);
    }),
  );
});

layer(NodeServices.layer)("readFirstParent merges and renames", (it) => {
  it.effect("sees a file only a merge adds, and a .ts that became a .md", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "doc.ts": lines(12, "words"),
      });
      yield* repo.git("checkout", "-q", "-b", "side");
      yield* repo.commit("2026-03-02T12:00:00Z", { "side.ts": "export {};\n" });
      yield* repo.git("checkout", "-q", "-");
      yield* repo.commit("2026-03-03T12:00:00Z", { "main.ts": "export {};\n" });
      yield* repo.git("merge", "--no-ff", "--no-commit", "side");
      yield* repo.commit("2026-03-04T12:00:00Z", { "evil.ts": "export {};\n" });
      yield* repo.git("mv", "doc.ts", "doc.md");
      yield* repo.commit("2026-03-05T12:00:00Z");

      const chain = yield* chainOf(repo);

      const names = Object.keys(replayed(chain));
      assert.deepStrictEqual(names, [
        "doc.md",
        "evil.ts",
        "main.ts",
        "side.ts",
      ]);
    }),
  );
});

layer(NodeServices.layer)("readFirstParent entries", (it) => {
  it.effect(
    "reads the blobs, modes and committer time of each commit, oldest first, and keeps an empty commit",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "run.sh": "echo 1\n" });
        yield* fs.chmod(path.join(repo.directory, "run.sh"), 0o755);
        yield* repo.commit("2026-03-02T12:00:00Z", { "run.sh": "echo 2\n" });
        yield* repo.commit("2026-03-03T12:00:00Z");
        const first = (yield* repo.git("rev-parse", "HEAD~2:run.sh")).trim();
        const second = (yield* repo.git("rev-parse", "HEAD~1:run.sh")).trim();

        const chain = yield* chainOf(repo);

        assert.deepStrictEqual(
          chain.map(({ time, changes }) => [time, changes]),
          [
            [
              Date.parse("2026-03-01T12:00:00Z") / 1000,
              [{ path: "run.sh", oid: first, mode: "100644" }],
            ],
            [
              Date.parse("2026-03-02T12:00:00Z") / 1000,
              [
                {
                  path: "run.sh",
                  oid: second,
                  previousOid: first,
                  mode: "100755",
                  previousMode: "100644",
                },
              ],
            ],
            [Date.parse("2026-03-03T12:00:00Z") / 1000, []],
          ],
        );
      }),
  );
});
