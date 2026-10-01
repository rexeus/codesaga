import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { InspectResult, Report } from "@codesaga/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { makeShallowClone } from "../testing/git-repository.js";
import { startMcpSession } from "../testing/mcp-session.js";
import {
  makeGithubProject,
  makeTeamProject,
  withoutGhOnPath,
} from "../testing/projects.js";
import { searchResult } from "../testing/stub-github.js";

const decodeReport = Schema.decodeUnknownEffect(Report);

const mergedPullRequest = {
  number: 1,
  createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  mergedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
  closedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
  author: { kind: "User", login: "ada" },
  reviews: { totalCount: 0, nodes: [] },
};

// Knowledge directories need three files; the third adds two lines to the team project's six.
const makeBlameProject = Effect.map(makeTeamProject, (repo) => {
  repo.commit(1, { "src/c.ts": "c1\nc2\n" });
  return repo;
});

// Real clock: the commits are dated relative to now.
describe("codesaga mcp blame", () => {
  it.live("adds line owners to analyze and inspect only when asked", () =>
    Effect.gen(function* () {
      const repo = yield* makeBlameProject;
      const session = yield* startMcpSession(repo.root);

      const without = yield* session.callTool("analyze", {});
      const withBlame = yield* session.callTool("analyze", { blame: true });
      const inspected = yield* session.callTool("inspect", {
        patterns: ["src"],
        blame: true,
      });

      expect(
        (yield* decodeReport(without.structuredContent)).knowledge
          .directories[0]?.lineOwners,
      ).toBeUndefined();
      expect(
        (yield* decodeReport(withBlame.structuredContent)).knowledge
          .directories[0]?.lineOwners?.lines,
      ).toBe(8);
      const { matches } = yield* Schema.decodeUnknownEffect(InspectResult)(
        inspected.structuredContent,
      );
      expect(matches[0]?.lineOwners?.lines).toBe(8);
    }).pipe(Effect.scoped),
  );

  it.live("lets the config turn blame on and the parameter turn it off", () =>
    Effect.gen(function* () {
      const repo = yield* makeBlameProject;
      writeFileSync(join(repo.root, ".codesaga.json"), '{ "blame": true }');
      const session = yield* startMcpSession(repo.root);

      const fromConfig = yield* session.callTool("analyze", {});
      const overridden = yield* session.callTool("analyze", { blame: false });

      expect(
        (yield* decodeReport(fromConfig.structuredContent)).knowledge
          .directories[0]?.lineOwners,
      ).toBeDefined();
      expect(
        (yield* decodeReport(overridden.structuredContent)).knowledge
          .directories[0]?.lineOwners,
      ).toBeUndefined();
    }).pipe(Effect.scoped),
  );
});

describe("codesaga mcp github", () => {
  it.live(
    "adds the pull requests when asked, with the token from the environment",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeGithubProject;
        const session = yield* startMcpSession(repo.root, {
          env: { GH_TOKEN: "test-token" },
          github: () => searchResult([mergedPullRequest]),
        });

        const without = yield* session.callTool("analyze", {});
        const withGithub = yield* session.callTool("analyze", { github: true });

        expect(without.structuredContent).not.toHaveProperty("pullRequests");
        expect(
          (yield* decodeReport(withGithub.structuredContent)).pullRequests,
        ).toMatchObject({ repository: "acme/web", opened: 1, merged: 1 });
      }).pipe(Effect.scoped),
  );

  it.live(
    "fails the call with the command line's message when there is no token",
    () =>
      Effect.gen(function* () {
        yield* withoutGhOnPath;
        const repo = yield* makeGithubProject;
        const session = yield* startMcpSession(repo.root);

        const result = yield* session.callTool("analyze", { github: true });

        expect([result.isError, result.content[0]?.text]).toStrictEqual([
          true,
          "--github needs a GitHub token for github.com: set GH_TOKEN or GITHUB_TOKEN, or run `gh auth login`",
        ]);
      }).pipe(Effect.scoped),
  );
});

describe("codesaga mcp check in a shallow clone", () => {
  it.live("refuses to evaluate gates, as the command does", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      const clone = yield* makeShallowClone(repo, 2);
      const session = yield* startMcpSession(clone);

      const result = yield* session.callTool("check", { minTruckFactor: 1 });

      expect([result.isError, result.content[0]?.text]).toStrictEqual([
        true,
        "check needs the full history: this is a shallow clone (run git fetch --unshallow, or use fetch-depth: 0 in actions/checkout)",
      ]);
    }).pipe(Effect.scoped),
  );
});
