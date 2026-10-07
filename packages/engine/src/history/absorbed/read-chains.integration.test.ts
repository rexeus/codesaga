import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import { Git } from "../../git/git.js";
import { makeTempRepository } from "../../testing/temp-repository.js";
import type { TempRepository } from "../../testing/temp-repository.js";
import { readFirstParent } from "../first-parent.js";
import type { FirstParentCommit } from "../first-parent.js";
import { readHistory } from "../history.js";
import { readChains } from "./read-chains.js";

const isTs = (path: string) => path.endsWith(".ts");
const libOnly = (path: string) => path === "lib.ts";

const chainsOf = (
  repo: TempRepository,
  options: {
    readonly useCache?: boolean;
    readonly shallow?: boolean;
    readonly fingerprint?: string;
    readonly isReplayed?: (path: string) => boolean;
  } = {},
) =>
  Effect.gen(function* () {
    const head = (yield* repo.git("rev-parse", "HEAD")).trim();
    const { commits } = yield* readHistory({
      root: repo.directory,
      head,
      shallowBoundary: new Set(),
      useCache: false,
    });
    return yield* readChains({
      root: repo.directory,
      head,
      commits,
      shallow: options.shallow ?? false,
      useCache: options.useCache ?? false,
      isReplayed: options.isReplayed ?? isTs,
      fingerprint: options.fingerprint ?? "test",
    });
  }).pipe(Effect.provide(Git.layer(repo.directory)));

/** The files of each line after the commits, a merge replacing the lines it absorbs: line to path to blob id. */
const replayed = (chain: ReadonlyArray<FirstParentCommit>) => {
  const lines = new Map<number, Map<string, string>>();
  for (const { line = 0, absorbs = [], changes } of chain) {
    for (const absorbed of absorbs) {
      lines.delete(absorbed);
    }
    const files = lines.get(line) ?? new Map<string, string>();
    lines.set(line, files);
    for (const { path, oid } of changes) {
      if (oid === undefined) {
        files.delete(path);
      } else {
        files.set(path, oid);
      }
    }
  }
  return Object.fromEntries(
    [...lines].map(([line, files]) => [
      line,
      Object.fromEntries([...files].toSorted(([a], [b]) => a.localeCompare(b))),
    ]),
  );
};

/** The script files of HEAD's tree: path to blob id. */
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
          .filter(([path]) => isTs(path))
          .toSorted(([a], [b]) => a.localeCompare(b)),
      ),
    ),
  );

/** The branch the repository starts on, which git names by its configuration. */
const mainBranch = (repo: TempRepository) =>
  repo.git("branch", "--show-current").pipe(Effect.map((name) => name.trim()));

const blobOf = (repo: TempRepository, spec: string) =>
  repo.git("rev-parse", spec).pipe(Effect.map((text) => text.trim()));

/** The default branch with `app.ts` and `shared.ts`, and an unrelated history of three commits before it. */
const commitUnrelatedHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-03-10T12:00:00Z", {
      "app.ts": "export const app = 1;\n",
      "shared.ts": "export const shared = 1;\n",
    });
    const main = yield* mainBranch(repo);
    yield* repo.git("switch", "--orphan", "other");
    yield* repo.commit("2026-01-05T12:00:00Z", {
      "lib.ts": "export const lib = 1;\n",
      "shared.ts": "export const shared = 1;\n",
    });
    yield* repo.commit("2026-02-01T12:00:00Z", {
      "lib.ts": "export const lib = 2;\n",
    });
    yield* repo.commit("2026-02-02T12:00:00Z", {
      "util.ts": "export const util = 1;\n",
    });
    yield* repo.git("switch", main);
  });

const mergeOther = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.git(
      "merge",
      "--no-commit",
      "--allow-unrelated-histories",
      "other",
    );
    yield* repo.commit("2026-03-20T12:00:00Z");
  });

/** `git merge -s subtree` without the guessing: the history's tree under `lib/`. */
const mergeOtherUnderLib = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.git(
      "merge",
      "-s",
      "ours",
      "--no-commit",
      "--allow-unrelated-histories",
      "other",
    );
    yield* repo.git("read-tree", "--prefix=lib/", "-u", "other");
    yield* repo.commit("2026-03-20T12:00:00Z");
  });

const summary = (chain: ReadonlyArray<FirstParentCommit>) =>
  chain.map(({ line = 0, absorbs = [], changes }) => ({
    line,
    absorbs,
    paths: changes.map(({ path }) => path).toSorted(),
  }));

const absorbedPaths = (chain: ReadonlyArray<FirstParentCommit>) =>
  summary(chain.filter(({ line }) => line === 1)).flatMap(({ paths }) => paths);

layer(NodeServices.layer)("readChains over unrelated histories", (it) => {
  it.effect(
    "replays an unrelated history merged in before the chain begins, each history in its own path state until the merge replaces it",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitUnrelatedHistory(repo);
        yield* mergeOther(repo);

        const chain = yield* chainsOf(repo);

        assert.deepStrictEqual(summary(chain), [
          { line: 1, absorbs: [], paths: ["lib.ts", "shared.ts"] },
          { line: 1, absorbs: [], paths: ["lib.ts"] },
          { line: 1, absorbs: [], paths: ["util.ts"] },
          { line: 0, absorbs: [], paths: ["app.ts", "shared.ts"] },
          { line: 0, absorbs: [1], paths: ["lib.ts", "util.ts"] },
        ]);
        assert.deepStrictEqual(replayed(chain), { 0: yield* treeOf(repo) });
        assert.deepStrictEqual(replayed(chain.slice(0, 3)), {
          1: {
            "lib.ts": yield* blobOf(repo, "other:lib.ts"),
            "shared.ts": yield* blobOf(repo, "other:shared.ts"),
            "util.ts": yield* blobOf(repo, "other:util.ts"),
          },
        });
      }),
  );

  it.effect(
    "names the files of a history that was merged under a directory by the path the merge gave them",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitUnrelatedHistory(repo);
        yield* mergeOtherUnderLib(repo);

        const chain = yield* chainsOf(repo);

        assert.deepStrictEqual(summary(chain), [
          { line: 1, absorbs: [], paths: ["lib/lib.ts", "lib/shared.ts"] },
          { line: 1, absorbs: [], paths: ["lib/lib.ts"] },
          { line: 1, absorbs: [], paths: ["lib/util.ts"] },
          { line: 0, absorbs: [], paths: ["app.ts", "shared.ts"] },
          {
            line: 0,
            absorbs: [1],
            paths: ["lib/lib.ts", "lib/shared.ts", "lib/util.ts"],
          },
        ]);
        assert.deepStrictEqual(replayed(chain), { 0: yield* treeOf(repo) });
      }),
  );
});

layer(NodeServices.layer)("readChains over ordinary histories", (it) => {
  it.effect(
    "reads the chain of the head alone, as readFirstParent does, in a linear history and after a merge of a branch",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });
        const main = yield* mainBranch(repo);
        yield* repo.git("switch", "--create", "side");
        yield* repo.commit("2026-03-02T12:00:00Z", { "b.ts": "b\n" });
        yield* repo.git("switch", main);
        yield* repo.commit("2026-03-03T12:00:00Z", { "c.ts": "c\n" });
        yield* repo.git("merge", "--no-ff", "--no-edit", "side");

        const chain = yield* chainsOf(repo);

        const alone = yield* readFirstParent("HEAD").pipe(
          Effect.provide(Git.layer(repo.directory)),
        );
        assert.deepStrictEqual(chain, alone);
        assert.strictEqual(
          chain.some(
            ({ line, absorbs }) => line !== undefined || absorbs !== undefined,
          ),
          false,
        );
      }),
  );
});

layer(NodeServices.layer)("readChains over histories it leaves alone", (it) => {
  it.effect(
    "leaves a history that was merged into a branch to the merge of that branch",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });
        const main = yield* mainBranch(repo);
        yield* repo.git("switch", "--create", "side");
        yield* repo.commit("2026-03-02T12:00:00Z", { "b.ts": "b\n" });
        yield* repo.git("switch", "--orphan", "other");
        yield* repo.commit("2026-01-02T12:00:00Z", { "x.ts": "x\n" });
        yield* repo.git("switch", "side");
        yield* repo.git(
          "merge",
          "--no-commit",
          "--allow-unrelated-histories",
          "other",
        );
        yield* repo.commit("2026-03-03T12:00:00Z");
        yield* repo.git("switch", main);
        yield* repo.git("merge", "--no-ff", "--no-edit", "side");

        const chain = yield* chainsOf(repo);

        assert.deepStrictEqual(
          chain.map(({ line }) => line),
          [undefined, undefined],
        );
        assert.deepStrictEqual(replayed(chain), { 0: yield* treeOf(repo) });
      }),
  );
});

layer(NodeServices.layer)(
  "readChains over a history that merged the lineage",
  (it) => {
    it.effect(
      "leaves a history that merged the default branch before it was merged back, whose merge would add the branch's files again",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "a.ts": "a\n",
            "b.ts": "b\n",
          });
          const main = yield* mainBranch(repo);
          yield* repo.git("switch", "--orphan", "other");
          yield* repo.commit("2026-01-02T12:00:00Z", { "x.ts": "x\n" });
          yield* repo.git(
            "merge",
            "--no-commit",
            "--allow-unrelated-histories",
            main,
          );
          yield* repo.commit("2026-03-05T12:00:00Z");
          yield* repo.git("switch", main);
          yield* repo.git("merge", "--no-ff", "--no-edit", "other");

          const chain = yield* chainsOf(repo);

          assert.deepStrictEqual(
            chain.map(({ line }) => line),
            [undefined, undefined],
          );
          assert.deepStrictEqual(replayed(chain), { 0: yield* treeOf(repo) });
        }),
    );

    it.effect("reads no absorbed history in a shallow clone", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitUnrelatedHistory(repo);
        yield* mergeOther(repo);

        const chain = yield* chainsOf(repo, { shallow: true });

        assert.deepStrictEqual(
          chain.map(({ line }) => line),
          [undefined, undefined],
        );
      }),
    );
  },
);

layer(NodeServices.layer)("readChains with the cache", (it) => {
  it.effect(
    "returns the same chains from the cache, which keeps the absorbed history and the directory it was put under",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* makeTempRepository;
        yield* commitUnrelatedHistory(repo);
        yield* mergeOtherUnderLib(repo);

        const first = yield* chainsOf(repo, { useCache: true });
        const second = yield* chainsOf(repo, { useCache: true });

        assert.isTrue(
          yield* fs.exists(`${repo.directory}/.git/codesaga/absorbed-v1.json`),
        );
        assert.deepStrictEqual(second, first);
        assert.deepStrictEqual(replayed(second), { 0: yield* treeOf(repo) });
      }),
  );
});

layer(NodeServices.layer)("readChains with a changed cache rule", (it) => {
  it.effect(
    "reads the chains again when the fingerprint of the rule that picks the changes differs",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitUnrelatedHistory(repo);
        yield* mergeOther(repo);
        const first = yield* chainsOf(repo, {
          useCache: true,
          fingerprint: "1",
        });
        const sameRule = yield* chainsOf(repo, {
          useCache: true,
          fingerprint: "1",
          isReplayed: libOnly,
        });
        const newRule = yield* chainsOf(repo, {
          useCache: true,
          fingerprint: "2",
          isReplayed: libOnly,
        });

        assert.deepStrictEqual(absorbedPaths(first), [
          "lib.ts",
          "shared.ts",
          "lib.ts",
          "util.ts",
        ]);
        assert.deepStrictEqual(sameRule, first);
        assert.deepStrictEqual(absorbedPaths(newRule), ["lib.ts", "lib.ts"]);
      }),
  );
});
