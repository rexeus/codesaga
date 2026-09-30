// Repository shapes and host conditions shared by the CLI journeys.
import { Effect } from "effect";

import { makeGitRepository } from "./git-repository.js";

const ada = { name: "Ada Lovelace", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };
const dependabot = {
  name: "dependabot[bot]",
  email: "49699333+dependabot[bot]@users.noreply.github.com",
};

/**
 * Five commits by two people and Dependabot, dated relative to now:
 * 400 days ago Ada adds a file, 60 days ago Ada edits it, 20 days ago Grace
 * adds another with Claude as co-author, 10 days ago Dependabot changes the
 * lockfile, 5 days ago Ada edits again. The branch is `main`.
 */
export const makeTeamProject = Effect.map(makeGitRepository, (repo) => {
  repo.commit(
    400,
    { "src/a.ts": "a1\n", "pnpm-lock.yaml": "l1\n" },
    { author: ada },
  );
  repo.commit(60, { "src/a.ts": "a1\na2\n" }, { author: ada });
  repo.commit(
    20,
    { "src/b.ts": "b1\nb2\nb3\n" },
    {
      author: grace,
      message:
        "Add b\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
    },
  );
  repo.commit(10, { "pnpm-lock.yaml": "l1\nl2\n" }, { author: dependabot });
  repo.commit(5, { "src/a.ts": "a1\na2\na3\n" }, { author: ada });
  return repo;
});

/** Empties PATH for the scope, so spawning git fails as on a machine without it. */
export const withoutGitOnPath = Effect.acquireRelease(
  Effect.sync(() => {
    const saved = process.env["PATH"];
    process.env["PATH"] = "";
    return saved;
  }),
  (saved) =>
    Effect.sync(() => {
      process.env["PATH"] = saved;
    }),
);
