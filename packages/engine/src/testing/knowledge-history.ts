// Tests only: a small history with known experts, shared by the knowledge and inspect integration tests.
import { Effect } from "effect";

import type { TempRepository } from "./temp-repository.js";

const lines = (prefix: string, count: number): string =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}\n`).join("");

const ada = { name: "Ada Lovelace", email: "ada@example.com" };
const adaOldEmail = { name: "Ada Lovelace", email: "ada@old.example" };
export const grace = { name: "Grace", email: "grace@example.com" };
const dependabot = {
  name: "dependabot[bot]",
  email: "49699333+dependabot[bot]@users.noreply.github.com",
};

const bundle = (directory: string, prefix: string, count: number) =>
  Object.fromEntries(
    ["x", "y", "z"].map((name) => [
      `${directory}/${name}.ts`,
      lines(prefix, count),
    ]),
  );

/**
 * Ada owns `src`; Grace creates `web`, and Ada (under an old email that
 * `.mailmap` merges into hers) extends every file of it; Dependabot edits
 * one web file last.
 *  1  01-05  Ada          adds src/{x,y,z}.ts and .mailmap
 *  2  02-01  Grace        adds web/{x,y,z}.ts
 *  3  02-10  Ada, old     appends to web/{x,y,z}.ts
 *  4  02-15  Dependabot   appends to web/x.ts
 */
export const commitKnowledgeHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(
      "2026-01-05T09:00:00Z",
      {
        ...bundle("src", "s", 20),
        ".mailmap": "Ada Lovelace <ada@example.com> <ada@old.example>\n",
      },
      { author: ada },
    );
    yield* repo.commit("2026-02-01T09:00:00Z", bundle("web", "w", 20), {
      author: grace,
    });
    yield* repo.commit("2026-02-10T09:00:00Z", bundle("web", "w", 40), {
      author: adaOldEmail,
    });
    yield* repo.commit(
      "2026-02-15T09:00:00Z",
      { "web/x.ts": lines("w", 40) + lines("bump", 60) },
      { author: dependabot },
    );
  });
