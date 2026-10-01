import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { NotAGithubRemote } from "./github-errors.js";
import { readOrigin } from "./remote.js";

type Origin = readonly [url: string, host: string, owner: string, name: string];

const readable: ReadonlyArray<Origin> = [
  ["https://github.com/rexeus/codesaga", "github.com", "rexeus", "codesaga"],
  [
    "https://github.com/rexeus/codesaga.git",
    "github.com",
    "rexeus",
    "codesaga",
  ],
  ["https://github.com/rexeus/codesaga/", "github.com", "rexeus", "codesaga"],
  [
    "https://x-access-token:s3cret@github.com/rexeus/codesaga.git",
    "github.com",
    "rexeus",
    "codesaga",
  ],
  ["git@github.com:rexeus/codesaga.git", "github.com", "rexeus", "codesaga"],
  ["git@github.com:rexeus/code.saga", "github.com", "rexeus", "code.saga"],
  [
    "ssh://git@github.com/rexeus/codesaga.git",
    "github.com",
    "rexeus",
    "codesaga",
  ],
  [
    "ssh://git@github.com:22/rexeus/codesaga.git",
    "github.com",
    "rexeus",
    "codesaga",
  ],
  ["git://GitHub.com/rexeus/codesaga.git", "github.com", "rexeus", "codesaga"],
  [
    "git@git.acme.example:platform/web.git",
    "git.acme.example",
    "platform",
    "web",
  ],
  [
    "https://git.acme.example:8443/platform/web",
    "git.acme.example",
    "platform",
    "web",
  ],
];

const unreadable = [
  "/srv/git/codesaga.git",
  "../codesaga",
  "file:///srv/git/codesaga.git",
  "https://gitlab.com/group/subgroup/project.git",
  "https://github.com/rexeus",
  "git@github.com:codesaga.git",
];

layer(NodeServices.layer)("readOrigin", (it) => {
  it.effect(
    "reads the host, owner and name from every URL form git keeps",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.git("remote", "add", "origin", "placeholder");
        const read = (url: string) =>
          repo
            .git("remote", "set-url", "origin", url)
            .pipe(
              Effect.andThen(readOrigin),
              Effect.provide(Git.layer(repo.directory)),
            );

        const origins = yield* Effect.forEach(readable, ([url]) => read(url));

        assert.deepStrictEqual(
          origins,
          readable.map(([, host, owner, name]) => ({ host, owner, name })),
        );
      }),
  );

  it.effect(
    "fails with NotAGithubRemote, without credentials, for a URL that names no owner and name",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.git("remote", "add", "origin", "placeholder");
        const failureOf = (url: string) =>
          repo
            .git("remote", "set-url", "origin", url)
            .pipe(
              Effect.andThen(Effect.flip(readOrigin)),
              Effect.provide(Git.layer(repo.directory)),
            );

        const failures = yield* Effect.forEach(
          [...unreadable, "https://user:s3cret@host.example/a/b/c"],
          failureOf,
        );

        assert.deepStrictEqual(failures, [
          ...unreadable.map((remote) => new NotAGithubRemote({ remote })),
          new NotAGithubRemote({ remote: "https://host.example/a/b/c" }),
        ]);
      }),
  );
});
