import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";

const trailersOf = (directory: string, head: string) =>
  readHistory({
    root: directory,
    head,
    shallowBoundary: new Set(),
    useCache: false,
  }).pipe(
    Effect.map(({ commits }) => commits.flatMap(({ trailers }) => trailers)),
    Effect.provide(Git.layer(directory)),
  );

const message = (...coAuthors: ReadonlyArray<string>): string =>
  `work\n\n${coAuthors.map((line) => `Co-authored-by: ${line}`).join("\n")}`;

layer(NodeServices.layer)("readHistory co-author trailers", (it) => {
  it.effect(
    "resolves an aliased Co-authored-by trailer through .mailmap and leaves the main address, other trailers and unmapped people alone",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          ".mailmap":
            "Grace Hopper <grace@example.com> <12+grace@users.noreply.github.com>\n",
        });
        yield* repo.commit(
          "2026-03-02T12:00:00Z",
          { "a.ts": "1\n" },
          {
            message: `${message(
              "Grace H <12+Grace@users.noreply.github.com>",
              "Grace <grace@example.com>",
              "Linus <linus@example.com>",
              "broken",
            )}\nReviewed-by: Grace H <12+grace@users.noreply.github.com>`,
          },
        );
        const head = (yield* repo.git("rev-parse", "HEAD")).trim();

        const trailers = yield* trailersOf(repo.directory, head);

        assert.deepStrictEqual(trailers, [
          { key: "Co-authored-by", value: "Grace Hopper <grace@example.com>" },
          { key: "Co-authored-by", value: "Grace <grace@example.com>" },
          { key: "Co-authored-by", value: "Linus <linus@example.com>" },
          { key: "Co-authored-by", value: "broken" },
          {
            key: "Reviewed-by",
            value: "Grace H <12+grace@users.noreply.github.com>",
          },
        ]);
      }),
  );
});

layer(NodeServices.layer)(
  "readHistory co-author trailers by mailmap source",
  (it) => {
    it.effect("reads the mailmap that mailmap.file names", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "team.mailmap":
            "Grace Hopper <grace@example.com> <grace@old.example>\n",
        });
        yield* repo.git("config", "mailmap.file", "team.mailmap");
        yield* repo.commit(
          "2026-03-02T12:00:00Z",
          { "a.ts": "1\n" },
          { message: message("Grace <grace@old.example>") },
        );
        const head = (yield* repo.git("rev-parse", "HEAD")).trim();

        const trailers = yield* trailersOf(repo.directory, head);

        assert.deepStrictEqual(trailers, [
          { key: "Co-authored-by", value: "Grace Hopper <grace@example.com>" },
        ]);
      }),
    );

    it.effect(
      "keeps trailers as written in a repository without a mailmap",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit(
            "2026-03-02T12:00:00Z",
            { "a.ts": "1\n" },
            { message: message("Grace <grace@old.example>") },
          );
          const head = (yield* repo.git("rev-parse", "HEAD")).trim();

          const trailers = yield* trailersOf(repo.directory, head);

          assert.deepStrictEqual(trailers, [
            { key: "Co-authored-by", value: "Grace <grace@old.example>" },
          ]);
        }),
    );
  },
);
