import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { GitCommandFailed } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { resolveCoAuthors } from "./co-author-mailmap.js";
import type { Commit } from "./parse-log.js";

const person = { name: "Ada", email: "ada@example.com" };

const commitWith = (...values: ReadonlyArray<string>): Commit => ({
  sha: "a".repeat(40),
  parents: [],
  time: 0,
  committerTime: 0,
  offsetMinutes: 0,
  author: person,
  committer: person,
  subject: "work",
  trailers: values.map((value) => ({ key: "Co-authored-by", value })),
  markers: [],
  changes: [],
});

/** A git whose `check-mailmap` answers with `text`, or fails when it is undefined; any other command is a defect. */
const gitAnswering = (text: string | undefined) =>
  Layer.succeed(
    Git,
    Git.of({
      stream: () => {
        throw new Error("unexpected git stream");
      },
      bytes: () => {
        throw new Error("unexpected git bytes");
      },
      text: () =>
        text === undefined
          ? Effect.fail(
              new GitCommandFailed({
                args: ["check-mailmap", "--stdin"],
                exitCode: 129,
                stderr: "usage: git check-mailmap",
              }),
            )
          : Effect.succeed(text),
    }),
  );

const resolvedWith = (text: string | undefined) =>
  resolveCoAuthors([
    commitWith("Grace <grace@old.example>", "Linus <linus@example.com>"),
  ]).pipe(
    Effect.provide(gitAnswering(text)),
    Effect.map((commits) => commits.flatMap(({ trailers }) => trailers)),
  );

const asWritten = [
  { key: "Co-authored-by", value: "Grace <grace@old.example>" },
  { key: "Co-authored-by", value: "Linus <linus@example.com>" },
];

it.effect("keeps the trailers as written when check-mailmap fails", () =>
  Effect.gen(function* () {
    assert.deepStrictEqual(yield* resolvedWith(undefined), asWritten);
  }),
);

it.effect(
  "keeps the trailers as written when check-mailmap answers a different number of lines",
  () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* resolvedWith("Grace Hopper <grace@example.com>\n"),
        asWritten,
      );
    }),
);

it.effect("applies an answer with one line per lookup", () =>
  Effect.gen(function* () {
    assert.deepStrictEqual(
      yield* resolvedWith(
        "Grace Hopper <grace@example.com>\nLinus <linus@example.com>\n",
      ),
      [
        { key: "Co-authored-by", value: "Grace Hopper <grace@example.com>" },
        asWritten[1],
      ],
    );
  }),
);
