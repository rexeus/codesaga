import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const lines = (prefix: string, count: number): string =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}\n`).join("");

const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };
const linus = { name: "Linus", email: "linus@example.com" };

/**
 * Five commits; a clone of depth 4 shows the last three, with Grace's one
 * exactly a year before 2026-03-12 and the territory `web` first changed by Linus.
 */
const commitHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    const files = Object.fromEntries(
      ["api", "web"].flatMap((territory) =>
        ["a", "b", "c"].map((name) => [
          `${territory}/${name}.ts`,
          lines(name, 2),
        ]),
      ),
    );
    yield* repo.commit("2024-01-01T09:00:00Z", files, { author: ada });
    yield* repo.commit(
      "2024-06-01T09:00:00Z",
      { "api/a.ts": lines("a", 3) },
      { author: ada },
    );
    yield* repo.commit(
      "2025-03-12T09:00:00Z",
      { "api/b.ts": lines("b", 3) },
      { author: grace },
    );
    yield* repo.commit(
      "2026-02-20T09:00:00Z",
      { "web/a.ts": lines("a", 3) },
      { author: linus },
    );
    yield* repo.commit(
      "2026-03-01T09:00:00Z",
      { "web/b.ts": lines("b", 3) },
      { author: ada },
    );
  });

layer(NodeServices.layer)("analyze a shallow clone's story", (it) => {
  it.effect(
    "says nothing that needs the first commits it cannot see, though a complete clone does",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);
        const clone = `${yield* fs.makeTempDirectoryScoped()}/clone`;
        yield* repo.git(
          "clone",
          "--quiet",
          "--depth",
          "4",
          `file://${repo.directory}`,
          clone,
        );

        const complete = yield* analyze(analyzeOptionsFor(repo));
        const shallow = yield* analyze(analyzeOptionsFor({ directory: clone }));

        const storyOf = (report: typeof complete) => ({
          statuses: Object.fromEntries(
            report.contributors.map(({ name, status }) => [name, status]),
          ),
          newHere: report.contributors
            .filter(({ badges }) =>
              badges.some(({ kind }) => kind === "new-here"),
            )
            .map(({ name }) => name),
          firstCommitStories: report.stories
            .map(({ kind }) => kind)
            .filter((kind) => kind === "newcomers" || kind === "anniversary"),
          webIsNew: report.knowledge.territories.territories
            .find(({ path }) => path === "web")
            ?.badges.some(({ kind }) => kind === "new-territory"),
        });

        assert.isTrue(shallow.repository.shallow);
        assert.deepStrictEqual(storyOf(complete), {
          statuses: { Ada: "active", Linus: "new", Grace: "dormant" },
          newHere: ["Linus"],
          firstCommitStories: [],
          webIsNew: false,
        });
        assert.deepStrictEqual(storyOf(shallow), {
          statuses: { Ada: "active", Linus: "active", Grace: "dormant" },
          newHere: [],
          firstCommitStories: [],
          webIsNew: false,
        });
      }),
  );
});
